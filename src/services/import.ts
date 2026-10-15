import type { Reading, Paragraph } from "../reading";
import { BOOK_DESIGN_COUNT } from "../reading";
import { apiRequest } from "./firebase";

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
    const file = new File(
      [await response.blob()],
      new URL(url).pathname.split("/").pop() || "document.pdf",
      { type: "application/pdf" },
    );
    const reading = await importPdf(file, progress);
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
  let worker:
    | Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>>
    | undefined;
  const parser = new LiteParse({
    ocrEnabled: true,
    extractBlocks: true,
    quiet: true,
    maxPages: 401,
    ocrFailureFatal: true,
    ocrEngine: {
      recognize: async (image) => {
        progress("Reading a scanned page…");
        const [
          { createWorker },
          { default: workerPath },
          { default: corePath },
        ] = await Promise.all([
          import("tesseract.js"),
          import("tesseract.js/dist/worker.min.js?url"),
          import("tesseract.js-core/tesseract-core-lstm.wasm.js?url"),
        ]);
        worker ??= await createWorker("eng", 1, {
          workerPath,
          corePath,
          langPath: "/ocr",
          workerBlobURL: false,
        });
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
