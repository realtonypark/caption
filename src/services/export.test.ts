import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { exportNotepad, notepadPdf } from "./export";
import type { Insight, LibraryState } from "../reading";
import { initialLibrary } from "../reading";

const text = (bytes: ArrayBuffer) => new TextDecoder("latin1").decode(bytes);
const insight = (id: string, patch: Partial<Insight> = {}): Insight => ({
  id,
  readingId: "web",
  passage: {
    quote: `Quote ${id}: a sentence worth keeping.`,
    ranges: [{ paragraph: 0, start: 0, end: 10 }],
  },
  note: "",
  exchanges: [],
  ...patch,
});
const stateWith = (insights: Insight[]): LibraryState => {
  const [sample] = initialLibrary().readings;
  return {
    readings: [
      {
        ...sample,
        id: "web",
        title: "A Walk Through the City",
        kind: "link",
        location: "https://example.com/article",
      },
    ],
    insights,
  };
};

it("writes a PDF with each reading's quotes, notes, answers, and links", async () => {
  const { bytes, replaced } = await notepadPdf(
    stateWith([
      insight("a", {
        note: "My own thought about café life.",
        exchanges: [
          {
            question: "Why does this matter?",
            answer: "Because context matters.\nIt shapes memory.",
            paragraphs: [1, 3],
            model: "Free model",
            sources: [{ url: "https://example.com/ref", title: "A reference" }],
          },
        ],
      }),
    ]),
  );
  const pdf = text(bytes);
  expect(pdf.startsWith("%PDF-")).toBe(true);
  for (const expected of [
    "Caption Notepad",
    "A Walk Through the City",
    "Quote a: a sentence worth keeping.",
    "My own thought about caf",
    "Why does this matter?",
    "Because context matters.",
    "It shapes memory.",
    "Citations: ",
    "A reference",
    "Caption Notepad \u00B7 1 of 1",
  ])
    expect(pdf).toContain(expected);
  expect(pdf).toContain("/URI (https://example.com/article)");
  expect(pdf).toContain("/URI (https://example.com/ref)");
  expect(replaced).toBe(0);
});

it("starts new pages for long notes and numbers them", async () => {
  const { bytes } = await notepadPdf(
    stateWith(
      Array.from({ length: 40 }, (_, i) =>
        insight(String(i), {
          note: "A note that takes some room. ".repeat(12),
        }),
      ),
    ),
  );
  const pages = Number(/\/Count (\d+)/.exec(text(bytes))?.[1]);
  expect(pages).toBeGreaterThan(2);
  expect(text(bytes)).toContain(`Caption Notepad \u00B7 ${pages} of ${pages}`);
});

it("replaces characters the PDF fonts cannot draw and reports how many", async () => {
  const { bytes, replaced } = await notepadPdf(
    stateWith([
      insight("a", { note: "Quotes “ok” — fine, but 漢字 and → arrows" }),
    ]),
  );
  expect(replaced).toBe(2);
  expect(text(bytes)).toContain("but ?? and -> arrows");
});

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:notes");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

it("downloads Markdown or PDF under its own file name", async () => {
  const downloads: string[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download);
  });
  const state = stateWith([insight("a", { note: "Keep this." })]);
  await expect(exportNotepad(state, "markdown")).resolves.toEqual({
    replaced: 0,
  });
  await expect(exportNotepad(state, "pdf")).resolves.toEqual({ replaced: 0 });
  expect(downloads).toEqual(["caption-notepad.md", "caption-notepad.pdf"]);
  const blobs = vi
    .mocked(URL.createObjectURL)
    .mock.calls.map(([b]) => b as Blob);
  expect(blobs.map((blob) => blob.type)).toEqual([
    "text/markdown;charset=utf-8",
    "application/pdf",
  ]);
});
