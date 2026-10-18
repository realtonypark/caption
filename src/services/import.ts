import type { Reading, Paragraph } from "../reading";
import {
  BOOK_DESIGN_COUNT,
  CHUNK_BUDGET,
  sourceFileKind,
  unsupportedFileMessage,
} from "../reading";
import { apiRequest } from "./firebase";

export type ImportProgress = (message: string, fraction?: number) => void;

// PDF text blocks carry hard line breaks from the page layout. Collapse them
// so a sentence reads as one sentence; tables and code keep their lines.
export const cleanBlockText = (text: string): string =>
  text
    .replace(/(\p{L})-\s*\n\s*(\p{L})/gu, "$1$2")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const pageFraction = (endPage: number, totalPages: number): number =>
  totalPages > 0 ? Math.min(1, endPage / totalPages) : 0;

export const partialFailureMessage = (
  fileCount: number,
  readingCount: number,
  failures: string[],
): string =>
  `Added ${readingCount} of ${fileCount}. Could not import: ${failures.join(" ")}`;

type OcrWorker = Awaited<
  ReturnType<(typeof import("tesseract.js"))["createWorker"]>
>;
const createOcrWorker = async (): Promise<OcrWorker> => {
  const [{ createWorker }, { default: workerPath }, { default: corePath }] =
    await Promise.all([
      import("tesseract.js"),
      import("tesseract.js/dist/worker.min.js?url"),
      import("tesseract.js-core/tesseract-core-lstm.wasm.js?url"),
    ]);
  return createWorker("eng", 1, {
    workerPath,
    corePath,
    langPath: "/ocr",
    workerBlobURL: false,
  });
};
const wordCount = (paragraphs: Paragraph[]) =>
  paragraphs.reduce(
    (total, { text }) => total + (text.match(/\S+/g)?.length ?? 0),
    0,
  );
const fileTitle = (file: File) => file.name.replace(/\.[^.]+$/, "");

const completeReading = (source: Omit<Reading, "id" | "design">): Reading => {
  const characters = source.paragraphs.reduce(
    (total, paragraph) =>
      total + paragraph.text.length + (paragraph.heading?.length ?? 0),
    0,
  );
  if (source.paragraphs.length > 10000 || characters > 600000)
    throw new Error(
      "This source is too large to use with AI. Try a shorter article or fewer pages.",
    );
  return {
    ...source,
    title: source.title.slice(0, 500),
    paragraphs: source.paragraphs.map((paragraph) => ({
      ...paragraph,
      ...(paragraph.heading
        ? { heading: paragraph.heading.slice(0, 2000) }
        : {}),
    })),
    id: crypto.randomUUID(),
    design: Math.floor(Math.random() * BOOK_DESIGN_COUNT),
  };
};
export const importLink = async (
  url: string,
  progress: ImportProgress,
): Promise<Reading> => {
  progress("Opening the source…");
  const response = await apiRequest("import", { url });
  if (response.headers.get("Content-Type")?.includes("application/pdf")) {
    const filename = decodeURIComponent(
      response.headers.get("X-Source-Filename") ?? "",
    );
    const file = new File(
      [await response.blob()],
      filename || new URL(url).pathname.split("/").pop() || "document.pdf",
      { type: "application/pdf" },
    );
    const reading = await importPdf(file, progress);
    // Google exports a PDF from a temporary address, so keep the shared link and document name.
    if (/^https:\/\/docs\.google\.com\/document\//i.test(url))
      return {
        ...reading,
        kind: "document",
        author: "Google Docs",
        title: filename ? fileTitle(file) : reading.title,
        location: url,
      };
    return {
      ...reading,
      location: response.headers.get("X-Source-URL") || url,
    };
  }
  const source = await response.json();
  if (
    !source.title ||
    !Array.isArray(source.paragraphs) ||
    !source.paragraphs.length
  )
    throw new Error("The source did not contain readable text.");
  return completeReading({ ...source, kind: "link" });
};

let wasmModule:
  | Promise<typeof import("@llamaindex/liteparse-wasm")>
  | undefined;

const initParser = async (progress: ImportProgress) => {
  progress("Preparing the PDF…");
  wasmModule ??= (async () => {
    try {
      const [module, { default: wasmUrl }] = await Promise.all([
        import("@llamaindex/liteparse-wasm"),
        import("@llamaindex/liteparse-wasm/liteparse_wasm_bg.wasm?url"),
      ]);
      await module.default({ module_or_path: wasmUrl });
      return module;
    } catch (error) {
      wasmModule = undefined;
      throw error;
    }
  })();
  const { LiteParse } = await wasmModule;
  let worker: OcrWorker | undefined;
  const parser = new LiteParse({
    ocrEnabled: true,
    extractBlocks: true,
    extractImages: true,
    quiet: true,
    maxPages: 401,
    ocrFailureFatal: true,
    ocrEngine: {
      recognize: async (image) => {
        progress("Reading a scanned page…");
        worker ??= await createOcrWorker();
        const result = await worker.recognize(
          new Blob([image as BlobPart], { type: "image/png" }),
          {},
          { blocks: true },
        );
        return (
          result.data.blocks?.flatMap((b) =>
            b.paragraphs.flatMap((p) =>
              p.lines.flatMap((l) =>
                l.words.map((w) => ({
                  text: w.text,
                  bbox: [w.bbox.x0, w.bbox.y0, w.bbox.x1, w.bbox.y1] as [
                    number,
                    number,
                    number,
                    number,
                  ],
                  confidence: w.confidence / 100,
                })),
              ),
            ),
          ) ?? []
        );
      },
    },
  });
  return {
    parser,
    free: async () => {
      parser.free();
      await worker?.terminate();
    },
  };
};

// Figures must fit one cloud chunk. Re-encode down toward the budget; the
// final serialized paragraph is gated exactly, never stored half-broken.
type FigureImage = { bytes: number[]; format: string };
export const figureParagraph = (
  image: string,
  page: number,
): Paragraph | null => {
  const paragraph: Paragraph = {
    text: "(Figure)",
    explanation: "",
    image,
    page,
  };
  return new TextEncoder().encode(JSON.stringify(paragraph)).length <=
    CHUNK_BUDGET
    ? paragraph
    : null;
};
const fitFigure = async (
  bytes: number[],
  format: string,
): Promise<string | null> => {
  try {
    const bitmap = await createImageBitmap(
      new Blob([new Uint8Array(bytes)], {
        type: `image/${format === "jpg" ? "jpeg" : format}`,
      }),
    );
    try {
      const fit =
        1200 / Math.max(1, Math.max(bitmap.width, bitmap.height));
      for (const [scale, quality] of [
        [1, 0.82],
        [1, 0.6],
        [0.5, 0.6],
        [0.5, 0.4],
      ]) {
        const ratio = Math.min(1, fit) * scale;
        const width = Math.max(1, Math.round(bitmap.width * ratio));
        const height = Math.max(1, Math.round(bitmap.height * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d")!;
        context.fillStyle = "#fff";
        context.fillRect(0, 0, width, height);
        context.drawImage(bitmap, 0, 0, width, height);
        const url = canvas.toDataURL("image/jpeg", quality);
        if (url.length <= 350_000) return url;
      }
      return null;
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
};

const parsePdfFile = async (
  parser: Awaited<ReturnType<typeof initParser>>["parser"],
  file: File,
  progress: ImportProgress,
): Promise<Reading> => {
  if (file.size > 25_000_000)
    throw new Error("Choose a PDF smaller than 25 MB.");
  let batch;
  try {
    batch = await parser.openBatchSession(
      new Uint8Array(await file.arrayBuffer()),
      10,
    );
    if (batch.totalPages > 400)
      throw new Error("Choose a PDF with at most 400 pages.");
    const paragraphs: Paragraph[] = [];
    let title = "";
    let heading: string | undefined;
    let kept = 0;
    let omitted = 0;
    for (
      let chunk = await batch.nextBatch();
      chunk;
      chunk = await batch.nextBatch()
    ) {
      progress(
        `Reading pages ${chunk.startPage}–${chunk.endPage} of ${batch.totalPages}…`,
        pageFraction(chunk.endPage, batch.totalPages),
      );
      const figuresByPage = new Map<number, Map<string, FigureImage>>();
      for (const image of chunk.result.images ?? []) {
        if (image.duplicateOf) continue;
        let figures = figuresByPage.get(image.page);
        if (!figures) {
          figures = new Map<string, FigureImage>();
          figuresByPage.set(image.page, figures);
        }
        figures.set(image.id, image);
      }
      for (const page of chunk.result.pages) {
        const figures: Map<string, FigureImage> =
          figuresByPage.get(page.pageNum) ?? new Map();
        for (const block of page.blocks ?? []) {
          if (block.kind === "figure") {
            const figure = block.id ? figures.get(block.id) : undefined;
            const image = figure
              ? await fitFigure(figure.bytes, figure.format)
              : null;
            const paragraph =
              image && kept < 80
                ? figureParagraph(image, page.pageNum)
                : null;
            if (paragraph) {
              kept++;
              paragraphs.push(paragraph);
            } else omitted++;
            continue;
          }
          const raw = (
            block.text ||
            block.lines?.join("\n") ||
            (block.rows
              ? [...(block.header ? [block.header] : []), ...block.rows]
                  .map((row) => row.map((c) => c.text).join(" | "))
                  .join("\n")
              : "")
          ).trim();
          if (!raw) continue;
          const text =
            block.kind === "table" ||
            block.kind === "code" ||
            block.kind === "grid_fallback"
              ? raw
              : cleanBlockText(raw);
          if (!text) continue;
          if (block.kind === "heading") {
            if (
              !title &&
              page.pageNum <= 2 &&
              block.level === 1 &&
              text.length < 200
            )
              title = text;
            else heading = text;
          } else {
            paragraphs.push({
              text,
              explanation: "",
              page: page.pageNum,
              ...(heading ? { heading } : {}),
            });
            heading = undefined;
          }
        }
      }
    }
    if (!paragraphs.length)
      throw new Error("No readable text or figures were found in this PDF.");
    return completeReading({
      title: title || file.name.replace(/\.pdf$/i, ""),
      author: "PDF",
      description:
        `${batch.totalPages} pages` +
        (omitted
          ? ` · ${omitted} figure${omitted === 1 ? "" : "s"} omitted`
          : ""),
      kind: "pdf",
      location: file.name,
      paragraphs,
    });
  } catch (error) {
    if (/password/i.test(String(error)))
      throw new Error(
        "This PDF is password protected. Remove its password and try again.",
        { cause: error },
      );
    throw error;
  } finally {
    batch?.free();
  }
};

export const importPdf = async (
  file: File,
  progress: ImportProgress,
): Promise<Reading> => {
  const { parser, free } = await initParser(progress);
  try {
    return await parsePdfFile(parser, file, progress);
  } finally {
    await free();
  }
};

const stripMarkdown = (text: string) =>
  text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1");

export const parseTextSource = (source: string, markdown: boolean) => {
  const paragraphs: Paragraph[] = [];
  let title = "";
  let heading: string | undefined;
  let lines: string[] = [];
  let fenced = false;
  let quoting = false;
  const flush = () => {
    const joined = fenced
      ? lines.join("\n").trim()
      : lines.join(" ").replace(/\s+/g, " ").trim();
    lines = [];
    const text = markdown && !fenced ? stripMarkdown(joined) : joined;
    if (!text) return;
    paragraphs.push({ text, explanation: "", ...(heading ? { heading } : {}) });
    heading = undefined;
  };
  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    if (markdown && /^\s*(```|~~~)/.test(raw)) {
      flush();
      fenced = !fenced;
      continue;
    }
    if (fenced) {
      lines.push(raw);
      continue;
    }
    let line = raw.trim();
    if (!line || (markdown && /^([-*_])(\s*\1){2,}$/.test(line))) {
      flush();
      quoting = false;
      continue;
    }
    if (markdown) {
      const quote = line.startsWith(">");
      if (quote !== quoting) flush();
      quoting = quote;
      line = line.replace(/^>\s?/, "");
      const atx = /^(#{1,6})\s+(.+?)(?:\s+#+)?$/.exec(line);
      if (atx) {
        flush();
        const text = stripMarkdown(atx[2]);
        if (!title && atx[1].length === 1 && text.length < 200) title = text;
        else heading = text;
        continue;
      }
      const item = /^(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
      if (item) {
        flush();
        line = item[1];
      }
    }
    lines.push(line);
  }
  flush();
  return { title, paragraphs };
};

export const importText = async (
  file: File,
  progress: ImportProgress,
): Promise<Reading> => {
  if (file.size > 5_000_000)
    throw new Error("Choose a text file smaller than 5 MB.");
  progress("Reading the file…");
  const markdown = !file.name.toLowerCase().endsWith(".txt");
  const { title, paragraphs } = parseTextSource(await file.text(), markdown);
  if (!paragraphs.length)
    throw new Error("No readable text was found in this file.");
  return completeReading({
    title: title || fileTitle(file),
    author: markdown ? "Markdown file" : "Text file",
    description: `${wordCount(paragraphs).toLocaleString()} words`,
    kind: "document",
    location: file.name,
    paragraphs,
  });
};

export const importDocx = async (
  file: File,
  progress: ImportProgress,
): Promise<Reading> => {
  if (file.size > 25_000_000)
    throw new Error("Choose a Word file smaller than 25 MB.");
  progress("Reading the Word document…");
  const { default: mammoth } = await import("mammoth/mammoth.browser");
  let html: string;
  try {
    ({ value: html } = await mammoth.convertToHtml(
      { arrayBuffer: await file.arrayBuffer() },
      {
        styleMap: [
          "p[style-name='Title'] => h1:fresh",
          "p[style-name='Subtitle'] => h2:fresh",
        ],
        // Embedded pictures are not read, so they cannot bloat the result.
        convertImage: mammoth.images.imgElement(async () => ({ src: "" })),
      },
    ));
  } catch (error) {
    throw new Error(
      "This Word file could not be read. Check that it is a .docx file that is not password protected.",
      { cause: error },
    );
  }
  const body = new DOMParser().parseFromString(html, "text/html").body;
  const clean = (text: string | null) =>
    (text ?? "").replace(/\s+/g, " ").trim();
  const paragraphs: Paragraph[] = [];
  let title = "";
  let heading: string | undefined;
  const add = (text: string) => {
    paragraphs.push({ text, explanation: "", ...(heading ? { heading } : {}) });
    heading = undefined;
  };
  for (const element of body.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,table")) {
    if (element.parentElement?.closest("li,table")) continue;
    if (element.tagName === "TABLE") {
      for (const row of element.querySelectorAll("tr")) {
        const text = [...row.children]
          .map((cell) => clean(cell.textContent))
          .filter(Boolean)
          .join(" | ");
        if (text) add(text);
      }
      continue;
    }
    const text = clean(element.textContent);
    if (!text) continue;
    if (/^H\d$/.test(element.tagName)) {
      if (!title && element.tagName === "H1" && text.length < 200) title = text;
      else heading = text;
    } else add(text);
  }
  if (!paragraphs.length)
    throw new Error("No readable text was found in this document.");
  return completeReading({
    title: title || fileTitle(file),
    author: "Word document",
    description: `${wordCount(paragraphs).toLocaleString()} words`,
    kind: "document",
    location: file.name,
    paragraphs,
  });
};

export const importImage = async (
  file: File,
  progress: ImportProgress,
): Promise<Reading> => {
  if (file.size > 15_000_000)
    throw new Error("Choose an image smaller than 15 MB.");
  progress("Reading the text in this image…");
  const worker = await createOcrWorker();
  try {
    const { data } = await worker.recognize(file, {}, { blocks: true });
    const paragraphs: Paragraph[] = (data.blocks ?? [])
      .flatMap((block) => block.paragraphs)
      .map((paragraph) => paragraph.text.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .map((text) => ({ text, explanation: "" }));
    if (!paragraphs.length)
      throw new Error(
        "No readable text was found in this image. Try a sharper or larger picture of the text.",
      );
    return completeReading({
      title: fileTitle(file),
      author: "Image",
      description: "Text read from an image",
      kind: "image",
      location: file.name,
      paragraphs,
    });
  } finally {
    await worker.terminate();
  }
};

export const importFile = async (
  file: File,
  progress: ImportProgress,
): Promise<Reading> => {
  switch (sourceFileKind(file)) {
    case "pdf":
      return importPdf(file, progress);
    case "docx":
      return importDocx(file, progress);
    case "text":
      return importText(file, progress);
    case "image":
      return importImage(file, progress);
    default:
      throw new Error(unsupportedFileMessage(file.name));
  }
};

export const importFiles = async (
  files: File[],
  progress: ImportProgress,
): Promise<{ readings: Reading[]; failures: string[] }> => {
  if (!files.length) throw new Error("Choose at least one file.");
  const unknown = files.filter((file) => !sourceFileKind(file));
  if (unknown.length)
    throw new Error(
      `These files are not supported: ${unknown.map((file) => file.name).join(", ")}.`,
    );
  // One tag for direct and OCR callbacks alike: the parser outlives each file.
  let tag = "";
  const dynamic: ImportProgress = (message, fraction) =>
    progress(`${tag}${message}`, fraction);
  const { parser, free } = files.some(
    (file) => sourceFileKind(file) === "pdf",
  )
    ? await initParser(dynamic)
    : { parser: undefined, free: async () => {} };
  const readings: Reading[] = [];
  const failures: string[] = [];
  try {
    for (const [index, file] of files.entries()) {
      tag = files.length > 1 ? `File ${index + 1} of ${files.length} · ` : "";
      try {
        readings.push(
          sourceFileKind(file) === "pdf"
            ? await parsePdfFile(parser!, file, dynamic)
            : await importFile(file, dynamic),
        );
      } catch (error) {
        failures.push(
          `${file.name}: ${error instanceof Error ? error.message : "Could not be imported."}`,
        );
      }
    }
  } finally {
    await free();
  }
  if (!readings.length) throw new Error(failures.join(" "));
  return { readings, failures };
};
