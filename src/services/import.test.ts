import { afterEach, expect, it, vi } from "vitest";
import {
  cleanBlockText,
  figureParagraph,
  importDocx,
  importFile,
  importImage,
  importText,
  pageFraction,
  parseTextSource,
  partialFailureMessage,
} from "./import";

const recognize = vi.fn();
const terminate = vi.fn();
vi.mock("./firebase", () => ({ apiRequest: vi.fn() }));
vi.mock("tesseract.js", () => ({
  createWorker: vi.fn(async () => ({ recognize, terminate })),
}));
afterEach(() => vi.clearAllMocks());

const WORD = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const PACKAGE = "http://schemas.openxmlformats.org/package/2006";
const RELATIONSHIPS =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
// A minimal .docx is a zip of a few XML parts; entries are stored without compression.
const zip = (files: Record<string, string>) => {
  const encoder = new TextEncoder();
  const parts: Uint8Array<ArrayBuffer>[] = [];
  const directory: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const local = new Uint8Array(30 + nameBytes.length);
    const header = new DataView(local.buffer);
    header.setUint32(0, 0x04034b50, true);
    header.setUint16(4, 20, true);
    header.setUint32(18, data.length, true);
    header.setUint32(22, data.length, true);
    header.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    const entry = new Uint8Array(46 + nameBytes.length);
    const view = new DataView(entry.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint32(20, data.length, true);
    view.setUint32(24, data.length, true);
    view.setUint16(28, nameBytes.length, true);
    view.setUint32(42, offset, true);
    entry.set(nameBytes, 46);
    parts.push(local, data);
    directory.push(entry);
    offset += local.length + data.length;
  }
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, directory.length, true);
  view.setUint16(10, directory.length, true);
  view.setUint32(
    12,
    directory.reduce((total, entry) => total + entry.length, 0),
    true,
  );
  view.setUint32(16, offset, true);
  return [...parts, ...directory, end];
};
const docx = (body: string) =>
  new File(
    zip({
      "[Content_Types].xml": `<Types xmlns="${PACKAGE}/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`,
      "_rels/.rels": `<Relationships xmlns="${PACKAGE}/relationships"><Relationship Id="rId1" Type="${RELATIONSHIPS}/officeDocument" Target="word/document.xml"/></Relationships>`,
      "word/_rels/document.xml.rels": `<Relationships xmlns="${PACKAGE}/relationships"><Relationship Id="rId1" Type="${RELATIONSHIPS}/styles" Target="styles.xml"/></Relationships>`,
      "word/styles.xml": `<w:styles xmlns:w="${WORD}"><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>`,
      "word/document.xml": `<w:document xmlns:w="${WORD}"><w:body>${body}</w:body></w:document>`,
    }),
    "field-notes.docx",
  );
const paragraph = (text: string, style?: string) =>
  `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

it("splits plain text on blank lines and rejoins hard-wrapped lines", () => {
  const { title, paragraphs } = parseTextSource(
    "First line wraps\nonto a second line.\n\n\nSecond   paragraph.\r\n# not a heading",
    false,
  );
  expect(title).toBe("");
  expect(paragraphs.map((p) => p.text)).toEqual([
    "First line wraps onto a second line.",
    "Second paragraph. # not a heading",
  ]);
});

it("reads Markdown headings, lists, quotes, links, and code", () => {
  const { title, paragraphs } = parseTextSource(
    [
      "# My Notes",
      "",
      "## Reading",
      "Some **bold** text with a [link](https://example.com) and `code`.",
      "",
      "- one",
      "- two",
      "> quoted line",
      "",
      "---",
      "```",
      "let x = 1;",
      "  let y = 2;",
      "```",
    ].join("\n"),
    true,
  );
  expect(title).toBe("My Notes");
  expect(paragraphs).toEqual([
    {
      text: "Some bold text with a link and code.",
      explanation: "",
      heading: "Reading",
    },
    { text: "one", explanation: "" },
    { text: "two", explanation: "" },
    { text: "quoted line", explanation: "" },
    { text: "let x = 1;\n  let y = 2;", explanation: "" },
  ]);
});

it("imports text and Markdown files as documents", async () => {
  const progress = vi.fn();
  const note = await importText(
    new File(["# Field notes\n\nThe heron stood still."], "notes.md"),
    progress,
  );
  expect(note).toMatchObject({
    title: "Field notes",
    kind: "document",
    author: "Markdown file",
    location: "notes.md",
    description: "4 words",
  });
  const plain = await importFile(
    new File(["Just a line."], "journal.txt"),
    progress,
  );
  expect(plain).toMatchObject({ title: "journal", author: "Text file" });
  await expect(
    importText(new File(["\n \n"], "blank.txt"), progress),
  ).rejects.toThrow(/No readable text/);
  await expect(
    importText(new File([new Uint8Array(5_000_001)], "big.txt"), progress),
  ).rejects.toThrow(/smaller than 5 MB/);
});

it("reads a Word document's title, headings, and tables", async () => {
  const reading = await importDocx(
    docx(
      [
        paragraph("Field Notes", "Title"),
        paragraph("Morning", "Heading1"),
        paragraph("The tide came in slowly."),
        `<w:tbl><w:tr><w:tc>${paragraph("Key")}</w:tc><w:tc>${paragraph("Value")}</w:tc></w:tr></w:tbl>`,
        paragraph("   "),
      ].join(""),
    ),
    vi.fn(),
  );
  expect(reading).toMatchObject({
    title: "Field Notes",
    kind: "document",
    author: "Word document",
    location: "field-notes.docx",
  });
  expect(reading.paragraphs).toEqual([
    { text: "The tide came in slowly.", explanation: "", heading: "Morning" },
    { text: "Key | Value", explanation: "" },
  ]);
});

it("reports Word files that cannot be read or are empty", async () => {
  await expect(
    importDocx(new File(["not a zip"], "broken.docx"), vi.fn()),
  ).rejects.toThrow(/could not be read/);
  await expect(importDocx(docx(paragraph("  ")), vi.fn())).rejects.toThrow(
    /No readable text/,
  );
});

it("reads text from an image and always stops the OCR worker", async () => {
  recognize.mockResolvedValueOnce({
    data: {
      blocks: [
        {
          paragraphs: [{ text: "Hello\nworld  again\n" }, { text: "  " }],
        },
        { paragraphs: [{ text: "Second block" }] },
      ],
    },
  });
  const reading = await importImage(
    new File(["png"], "Screenshot 1.png", { type: "image/png" }),
    vi.fn(),
  );
  expect(reading).toMatchObject({
    title: "Screenshot 1",
    kind: "image",
    author: "Image",
  });
  expect(reading.paragraphs.map((p) => p.text)).toEqual([
    "Hello world again",
    "Second block",
  ]);
  expect(terminate).toHaveBeenCalledTimes(1);

  recognize.mockResolvedValueOnce({ data: { blocks: null } });
  await expect(
    importFile(new File(["png"], "blank.png", { type: "image/png" }), vi.fn()),
  ).rejects.toThrow(/No readable text was found in this image/);
  expect(terminate).toHaveBeenCalledTimes(2);
});

it("rejects unsupported file types with guidance", async () => {
  await expect(
    importFile(new File(["x"], "sheet.xlsx"), vi.fn()),
  ).rejects.toThrow(/Choose a PDF, Word/);
  await expect(importFile(new File(["x"], "old.doc"), vi.fn())).rejects.toThrow(
    /Save it as \.docx/,
  );
});

it("joins hard line breaks inside a PDF text block", () => {
  expect(cleanBlockText("Studies of\nattention show\nresults")).toBe(
    "Studies of attention show results",
  );
  expect(cleanBlockText("an atten-\ntion test")).toBe("an attention test");
  expect(cleanBlockText("  spaced   out  ")).toBe("spaced out");
});

it("clamps page progress to the bar and names partial failures", () => {
  expect(pageFraction(401, 400)).toBe(1);
  expect(pageFraction(20, 40)).toBe(0.5);
  expect(partialFailureMessage(3, 2, ["b.pdf: too big"])).toBe(
    "Added 2 of 3. Could not import: b.pdf: too big",
  );
});

it("reports zero progress for an empty document", () => {
  expect(pageFraction(0, 0)).toBe(0);
});

it("omits figure images whose serialized paragraph exceeds the chunk budget", () => {
  const kept = figureParagraph("data:image/jpeg;base64,AAA", 3);
  expect(kept).toMatchObject({
    text: "(Figure)",
    image: "data:image/jpeg;base64,AAA",
    page: 3,
  });
  expect(figureParagraph("x".repeat(600_000), 1)).toBeNull();
});
