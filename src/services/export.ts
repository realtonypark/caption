import {
  notepadGroups,
  notepadMarkdown,
  passageLabel,
  type LibraryState,
} from "../reading";

export type ExportFormat = "markdown" | "pdf";

// Standard PDF fonts only draw Latin text (Windows-1252), so anything else becomes "?".
const SPACES = new RegExp("[\\u2002\\u2003\\u2009\\u202F\\t]", "g");
const INVISIBLE = new RegExp("[\\u200B-\\u200D\\uFEFF\\r]", "g");
const DASHES = new RegExp("[\\u2010-\\u2012\\u2212]", "g");
const UNSUPPORTED =
  /[^\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/gu;

const MARGIN = 56;
const BODY = 10.5;
const LEADING = 1.45;
const INK: [number, number, number] = [42, 38, 34];
const MUTED: [number, number, number] = [125, 116, 102];
const ACCENT: [number, number, number] = [174, 140, 83];
const LINK: [number, number, number] = [32, 84, 147];

export const notepadPdf = async (
  state: LibraryState,
): Promise<{ bytes: ArrayBuffer; replaced: number }> => {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const width = pageWidth - MARGIN * 2;
  let y = MARGIN;
  let replaced = 0;
  const clean = (text: string) =>
    text
      .replace(SPACES, " ")
      .replace(INVISIBLE, "")
      .replace(DASHES, "-")
      .replace(/→/g, "->")
      .replace(/←/g, "<-")
      .replace(UNSUPPORTED, () => {
        replaced += 1;
        return "?";
      });
  const write = (
    text: string,
    {
      size = BODY,
      style = "normal",
      color = INK,
      indent = 0,
      after = 8,
      keepWithNext = 0,
      bar = false,
      url,
    }: {
      size?: number;
      style?: "normal" | "bold" | "italic";
      color?: [number, number, number];
      indent?: number;
      after?: number;
      keepWithNext?: number;
      bar?: boolean;
      url?: string;
    } = {},
  ) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const height = size * LEADING;
    const lines = text
      .split("\n")
      .flatMap((line) =>
        doc.splitTextToSize(clean(line).trim() || " ", width - indent),
      );
    lines.forEach((line, index) => {
      // A heading never ends a page on its own.
      if (y + height + (index === 0 ? keepWithNext : 0) > pageHeight - MARGIN) {
        doc.addPage();
        y = MARGIN;
      }
      if (bar) {
        doc.setDrawColor(...ACCENT);
        doc.setLineWidth(2);
        doc.line(MARGIN + indent - 9, y, MARGIN + indent - 9, y + height);
      }
      if (url) doc.textWithLink(line, MARGIN + indent, y + size, { url });
      else doc.text(line, MARGIN + indent, y + size);
      y += height;
    });
    y += after;
  };
  const rule = () => {
    doc.setDrawColor(222, 215, 198);
    doc.setLineWidth(0.75);
    doc.line(MARGIN, y, pageWidth - MARGIN, y);
    y += 14;
  };
  const link = (value: string) => /^https?:\/\//i.test(value);

  write("Caption Notepad", { size: 24, style: "bold", after: 4 });
  write(
    `Exported ${new Date().toLocaleDateString(undefined, { dateStyle: "long" })}`,
    { size: 9, color: MUTED, after: 22 },
  );
  notepadGroups(state).forEach(({ reading, insights }, index) => {
    y += index ? 14 : 0;
    write(reading.title, {
      size: 16,
      style: "bold",
      after: 3,
      keepWithNext: 90,
    });
    if (reading.location)
      write(`Source: ${reading.location}`, {
        size: 9,
        color: link(reading.location) ? LINK : MUTED,
        url: link(reading.location) ? reading.location : undefined,
        after: 8,
      });
    else write(reading.author, { size: 9, color: MUTED, after: 8 });
    rule();
    for (const insight of insights) {
      write(passageLabel(insight.passage), {
        size: 8.5,
        style: "bold",
        color: ACCENT,
        after: 3,
        keepWithNext: 50,
      });
      write(insight.passage.quote, {
        style: "italic",
        indent: 14,
        bar: true,
        after: 8,
        keepWithNext: insight.note || insight.exchanges.length ? 40 : 0,
      });
      if (insight.note) {
        write("My note", {
          size: 8.5,
          style: "bold",
          color: MUTED,
          after: 2,
          keepWithNext: 30,
        });
        write(insight.note);
      }
      for (const exchange of insight.exchanges) {
        write("Question", {
          size: 8.5,
          style: "bold",
          color: MUTED,
          after: 2,
          keepWithNext: 40,
        });
        write(exchange.question, { style: "bold", after: 6 });
        write(exchange.model ? `Answer · ${exchange.model}` : "Answer", {
          size: 8.5,
          style: "bold",
          color: MUTED,
          after: 2,
          keepWithNext: 30,
        });
        write(exchange.answer, { after: 6 });
        if (exchange.paragraphs.length)
          write(
            `Citations: ${exchange.paragraphs.map((number) => `¶${number}`).join(", ")}`,
            { size: 9, color: MUTED, after: 4 },
          );
        for (const source of exchange.sources ?? [])
          write(source.title || source.url, {
            size: 9,
            color: link(source.url) ? LINK : MUTED,
            url: link(source.url) ? source.url : undefined,
            after: 3,
          });
        y += 6;
      }
      y += 8;
    }
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      `Caption Notepad · ${page} of ${pages}`,
      pageWidth / 2,
      pageHeight - 30,
      {
        align: "center",
      },
    );
  }
  doc.setProperties({
    title: "Caption Notepad",
    subject: "Notes exported from Caption",
    creator: "Caption",
  });
  return { bytes: doc.output("arraybuffer"), replaced };
};

const save = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Downloads the notes and reports how many characters a PDF could not draw. */
export const exportNotepad = async (
  state: LibraryState,
  format: ExportFormat,
): Promise<{ replaced: number }> => {
  if (format === "pdf") {
    const { bytes, replaced } = await notepadPdf(state);
    save(new Blob([bytes], { type: "application/pdf" }), "caption-notepad.pdf");
    return { replaced };
  }
  save(
    new Blob([notepadMarkdown(state)], { type: "text/markdown;charset=utf-8" }),
    "caption-notepad.md",
  );
  return { replaced: 0 };
};
