import { afterEach, expect, it, vi } from "vitest";
import { initialLibrary, saveInsight, wholeParagraph } from "./reading";
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
