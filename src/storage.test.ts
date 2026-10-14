import { afterEach, expect, it, vi } from "vitest";
import {
  initialLibrary,
  saveInsight,
  wholeParagraph,
  demoExchange,
} from "./reading";
import { readLibrary, writeLibrary } from "./storage";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

it("restores an insight and its book design after a browser reload", () => {
  const initial = initialLibrary();
  const saved = saveInsight(
    initial,
    "quiet-work",
    wholeParagraph(initial.readings[0], 1),
    { note: "Leave a return address." },
    "note",
  );
  expect(writeLibrary(saved)).toBeUndefined();
  expect(readLibrary()).toEqual({ state: saved });
});

it("reports damaged anchors without replacing the saved data", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const initial = initialLibrary();
  const state = saveInsight(
    initial,
    "quiet-work",
    { quote: "bad range", ranges: [{ paragraph: 100, start: 0, end: 5 }] },
    {},
    "bad",
  );
  writeLibrary(state);
  const before = localStorage.getItem("caption:library:v1");
  expect(readLibrary().warning).toBeTruthy();
  expect(localStorage.getItem("caption:library:v1")).toBe(before);
});

it("restores old notes and new colored question threads, and rejects invalid colors", () => {
  const initial = initialLibrary();
  const reading = initial.readings[0];
  const passage = wholeParagraph(reading, 0);
  const saved = saveInsight(
    initial,
    reading.id,
    passage,
    {
      color: "green",
      exchange: {
        ...demoExchange(reading, passage, "Why?"),
        threadId: "thread",
      },
    },
    "saved",
  );
  writeLibrary(saved);
  expect(readLibrary().state).toEqual(saved);
  const legacy = structuredClone(saved);
  delete legacy.insights[0].color;
  delete legacy.insights[0].highlighted;
  delete legacy.insights[0].exchanges[0].threadId;
  delete legacy.insights[0].exchanges[0].action;
  delete legacy.insights[0].exchanges[0].scope;
  writeLibrary(legacy);
  expect(readLibrary().state).toEqual(legacy);
  const invalid = JSON.parse(JSON.stringify(saved));
  invalid.insights[0].color = "invalid";
  localStorage.setItem("caption:library:v1", JSON.stringify(invalid));
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect(readLibrary().warning).toBeTruthy();
});
