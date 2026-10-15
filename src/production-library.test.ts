import { expect, it } from "vitest";
import {
  initialLibrary,
  saveInsight,
  stampLibrary,
  mergeLibraries,
  wholeParagraph,
} from "./reading";

it("merges account and device work while retaining deletion tombstones and newer edits", () => {
  const base = initialLibrary();
  const reading = base.readings[0];
  const passage = wholeParagraph(reading, 0);
  const local = stampLibrary(
    base,
    saveInsight(base, reading.id, passage, { note: "Device note" }, "note"),
    100,
  );
  const remote = stampLibrary(
    base,
    {
      ...base,
      readings: base.readings.filter((r) => r.id !== base.readings[1].id),
    },
    200,
  );
  const merged = mergeLibraries(local, remote);
  expect(merged.insights[0].note).toBe("Device note");
  expect(merged.readings.some((r) => r.id === base.readings[1].id)).toBe(false);
  const edited = stampLibrary(
    local,
    saveInsight(
      local,
      reading.id,
      passage,
      { note: "Updated on another device" },
      "unused",
    ),
    300,
  );
  expect(mergeLibraries(local, edited).insights[0].note).toBe(
    "Updated on another device",
  );
  expect(mergeLibraries(edited, local).insights[0].note).toBe(
    "Updated on another device",
  );
});

it("retries one answer without replacing unrelated notes or threads", () => {
  const state = initialLibrary();
  const reading = state.readings[0];
  const passage = wholeParagraph(reading, 0);
  let saved = saveInsight(
    state,
    reading.id,
    passage,
    {
      exchange: {
        question: "First",
        answer: "Old",
        paragraphs: [1],
        threadId: "first",
      },
    },
    "entry",
  );
  saved = saveInsight(
    saved,
    reading.id,
    passage,
    {
      exchange: {
        question: "Other",
        answer: "Keep",
        paragraphs: [1],
        threadId: "other",
      },
      note: "My note",
    },
    "unused",
  );
  const retried = saveInsight(
    saved,
    reading.id,
    passage,
    {
      replaceAnswer: {
        threadId: "first",
        exchange: {
          question: "First",
          answer: "New",
          paragraphs: [1],
          threadId: "first",
        },
      },
    },
    "unused",
  );
  expect(retried.insights[0].note).toBe("My note");
  expect(retried.insights[0].exchanges.map((e) => e.answer)).toEqual([
    "New",
    "Keep",
  ]);
});
