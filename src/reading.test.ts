import { describe, expect, it } from "vitest";
import {
  demoExchange,
  initialLibrary,
  normalizeLink,
  passageSegments,
  saveInsight,
} from "./reading";

describe("a saved reading insight", () => {
  it("keeps highlight, note, and AI exchange together without crossing source boundaries", () => {
    const initial = initialLibrary();
    const reading = initial.readings[0];
    const passage = {
      quote: reading.paragraphs[0].text.slice(0, 20),
      ranges: [{ paragraph: 0, start: 0, end: 20 }],
    };
    const highlighted = saveInsight(initial, reading.id, passage, {}, "first");
    const noted = saveInsight(
      highlighted,
      reading.id,
      passage,
      { note: "Recognition is not understanding." },
      "unused",
    );
    const answered = saveInsight(
      noted,
      reading.id,
      passage,
      { exchange: demoExchange(reading, passage, "What is the distinction?") },
      "unused",
    );
    expect(answered.insights).toHaveLength(1);
    expect(answered.insights[0]).toMatchObject({
      id: "first",
      note: "Recognition is not understanding.",
      exchanges: [{ paragraphs: [1] }],
    });
    const other = saveInsight(
      answered,
      initial.readings[1].id,
      {
        ...passage,
        quote: initial.readings[1].paragraphs[0].text.slice(0, 20),
      },
      {},
      "second",
    );
    expect(other.insights).toHaveLength(2);
    expect(other.insights[0].note).toBe("Recognition is not understanding.");
  });

  it("renders overlapping saved ranges without losing or duplicating article text", () => {
    const initial = initialLibrary();
    const text = initial.readings[0].paragraphs[0].text;
    const first = {
      quote: text.slice(2, 25),
      ranges: [{ paragraph: 0, start: 2, end: 25 }],
    };
    const second = {
      quote: text.slice(17, 40),
      ranges: [{ paragraph: 0, start: 17, end: 40 }],
    };
    const state = saveInsight(
      saveInsight(initial, "quiet-work", first, {}, "a"),
      "quiet-work",
      second,
      {},
      "b",
    );
    const segments = passageSegments(text, 0, state.insights);
    expect(segments.map((segment) => segment.text).join("")).toBe(text);
    expect(
      segments
        .filter((segment) => segment.insightId)
        .map((segment) => segment.text)
        .join(""),
    ).toBe(text.slice(2, 40));
  });
});

it("accepts a pasted web address but rejects executable schemes and whitespace", () => {
  expect(normalizeLink("example.com/essay")).toBe("https://example.com/essay");
  expect(() => normalizeLink("javascript:alert(1)")).toThrow();
  expect(() => normalizeLink("not a link")).toThrow();
});
