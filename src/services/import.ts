import type { Reading, Paragraph } from "../reading";
import {
  BOOK_DESIGN_COUNT,
  sourceFileKind,
  unsupportedFileMessage,
} from "../reading";
import { apiRequest } from "./firebase";

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
  progress: (message: string) => void,
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

export const importPdf = async (
  file: File,
  progress: (message: string) => void,
): Promise<Reading> => {
  if (file.size > 25_000_000)
    throw new Error("Choose a PDF smaller than 25 MB.");
  progress("Preparing the PDF…");
  const [{ default: init, LiteParse }, { default: wasmUrl }] =
    await Promise.all([
      import("@llamaindex/liteparse-wasm"),
      import("@llamaindex/liteparse-wasm/liteparse_wasm_bg.wasm?url"),
    ]);
  await init({ module_or_path: wasmUrl });
  let worker: OcrWorker | undefined;
  const parser = new LiteParse({
    ocrEnabled: true,
    extractBlocks: true,
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
    for (
      let chunk = await batch.nextBatch();
      chunk;
      chunk = await batch.nextBatch()
    ) {
      progress(
        `Reading pages ${chunk.startPage}–${chunk.endPage} of ${batch.totalPages}…`,
      );
      for (const page of chunk.result.pages) {
        for (const block of page.blocks ?? []) {
          const text = (
            block.text ||
            block.lines?.join("\n") ||
            (block.rows
              ? [...(block.header ? [block.header] : []), ...block.rows]
                  .map((row) => row.map((c) => c.text).join(" | "))
                  .join("\n")
              : "")
          ).trim();
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
      throw new Error("No readable text was found in this PDF.");
    return completeReading({
      title: title || file.name.replace(/\.pdf$/i, ""),
      author: "PDF",
      description: `${batch.totalPages} pages`,
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
    parser.free();
    await worker?.terminate();
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
  progress: (message: string) => void,
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
  progress: (message: string) => void,
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
  progress: (message: string) => void,
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
  progress: (message: string) => void,
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
