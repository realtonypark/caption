import { expect, it } from "vitest";
import { cleanBlockText, importText } from "./import";

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
