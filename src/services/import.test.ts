import { expect, it } from "vitest";
import {
  cleanBlockText,
  figureParagraph,
  importText,
  pageFraction,
  partialFailureMessage,
} from "./import";

it("joins hard line breaks inside a PDF text block", () => {
  expect(cleanBlockText("Studies of\nattention show\nresults")).toBe(
    "Studies of attention show results",
  );
  expect(cleanBlockText("an atten-\ntion test")).toBe("an attention test");
  expect(cleanBlockText("  spaced   out  ")).toBe("spaced out");
});

it("imports a text file split on blank lines", async () => {
  const reading = await importText(
    new File(["# Title\n\nFirst paragraph.\n\nSecond paragraph."], "notes.md"),
  );
  expect(reading.title).toBe("notes");
  expect(reading.kind).toBe("text");
  expect(reading.paragraphs.map((paragraph) => paragraph.text)).toEqual([
    "# Title",
    "First paragraph.",
    "Second paragraph.",
  ]);
  await expect(importText(new File(["   \n  "], "empty.txt"))).rejects.toThrow(
    "No readable text",
  );
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
