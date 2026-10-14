import { describe, expect, it } from "vitest";
import {
  demoExchange,
  initialLibrary,
  normalizeLink,
  answerThreads,
  wholeParagraph,
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

  it("opens nested highlights through their own text regardless of save order", () => {
    const initial = initialLibrary();
    const text = initial.readings[0].paragraphs[0].text;
    const outer = {
      quote: text.slice(0, 40),
      ranges: [{ paragraph: 0, start: 0, end: 40 }],
    };
    const inner = {
      quote: text.slice(10, 20),
      ranges: [{ paragraph: 0, start: 10, end: 20 }],
    };
    const saved = saveInsight(
      saveInsight(initial, "quiet-work", outer, {}, "outer"),
      "quiet-work",
      inner,
      {},
      "inner",
    );
    for (const insights of [saved.insights, saved.insights.toReversed()]) {
      const segments = passageSegments(text, 0, insights);
      expect(segments.map((segment) => segment.text).join("")).toBe(text);
      expect(segments.find((segment) => segment.start === 10)?.insightId).toBe(
        "inner",
      );
      expect(segments.find((segment) => segment.start === 0)?.insightId).toBe(
        "outer",
      );
      expect(segments.find((segment) => segment.start === 20)?.insightId).toBe(
        "outer",
      );
    }
  });
});

it("accepts a pasted web address but rejects executable schemes and whitespace", () => {
  expect(normalizeLink("example.com/essay")).toBe("https://example.com/essay");
  expect(() => normalizeLink("javascript:alert(1)")).toThrow();
  expect(() => normalizeLink("not a link")).toThrow();
});

it("accepts bare hosts with ports while rejecting unsupported schemes", () => {
  expect(normalizeLink("example.com:8080/essay")).toBe(
    "https://example.com:8080/essay",
  );
  expect(normalizeLink("localhost:5173")).toBe("https://localhost:5173/");
  expect(normalizeLink("http:example.com:8080/essay")).toBe(
    "http://example.com:8080/essay",
  );
  expect(() => normalizeLink("mailto:reader@example.com")).toThrow();
  expect(() => normalizeLink("ftp://example.com/essay")).toThrow();
});

it("keeps independent question threads and retains notes when a thread is removed", () => {
  const initial = initialLibrary();
  const reading = initial.readings[0];
  const passage = wholeParagraph(reading, 0);
  let state = saveInsight(
    initial,
    reading.id,
    passage,
    {
      exchange: {
        ...demoExchange(reading, passage, "First?"),
        threadId: "first",
      },
    },
    "insight",
  );
  state = saveInsight(
    state,
    reading.id,
    passage,
    {
      exchange: {
        ...demoExchange(reading, passage, "Second?"),
        threadId: "second",
      },
    },
    "unused",
  );
  expect(answerThreads(state.insights).map((thread) => thread.id)).toEqual([
    "first",
    "second",
  ]);
  state = saveInsight(
    state,
    reading.id,
    passage,
    { note: "Keep this", highlighted: true, color: "pink" },
    "unused",
  );
  state = saveInsight(
    state,
    reading.id,
    passage,
    { removeThread: "first" },
    "unused",
  );
  expect(answerThreads(state.insights).map((thread) => thread.id)).toEqual([
    "second",
  ]);
  expect(state.insights[0]).toMatchObject({ note: "Keep this", color: "pink" });
  state = saveInsight(
    state,
    reading.id,
    passage,
    { highlighted: false, note: "" },
    "unused",
  );
  expect(state.insights).toHaveLength(1);
  state = saveInsight(
    state,
    reading.id,
    passage,
    { removeThread: "second" },
    "unused",
  );
  expect(state.insights).toHaveLength(0);
});

it("composes a containing highlight with a nested answer without losing either anchor", () => {
  const initial = initialLibrary();
  const reading = initial.readings[0];
  const outer = wholeParagraph(reading, 0);
  const inner = {
    quote: outer.quote.slice(14, 22),
    ranges: [{ paragraph: 0, start: 14, end: 22 }],
  };
  const state = saveInsight(
    saveInsight(
      initial,
      reading.id,
      outer,
      { note: "Context", color: "blue" },
      "outer",
    ),
    reading.id,
    inner,
    {
      exchange: {
        ...demoExchange(reading, inner, "Why?"),
        threadId: "question",
      },
    },
    "inner",
  );
  const segments = passageSegments(outer.quote, 0, state.insights);
  expect(segments.find((segment) => segment.start === 14)).toMatchObject({
    insightId: "inner",
    highlighted: true,
    color: "blue",
    hasAnswer: true,
  });
  expect(segments.at(-1)?.noteInsightId).toBe("outer");
  expect(segments.map((segment) => segment.text).join("")).toBe(outer.quote);
});
