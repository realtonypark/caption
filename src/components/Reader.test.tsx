import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { initialLibrary, saveInsight, wholeParagraph } from "../reading";
import { Reader } from "./Reader";

afterEach(() => {
  cleanup();
  delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});

it("opens the nested note from its highlight while keeping the outer note reachable", () => {
  const initial = initialLibrary();
  const reading = initial.readings[0];
  const text = reading.paragraphs[0].text;
  const outer = {
    quote: text.slice(0, 40),
    ranges: [{ paragraph: 0, start: 0, end: 40 }],
  };
  const inner = {
    quote: text.slice(10, 20),
    ranges: [{ paragraph: 0, start: 10, end: 20 }],
  };
  const saved = saveInsight(
    saveInsight(initial, reading.id, outer, { note: "Outer thought" }, "outer"),
    reading.id,
    inner,
    { note: "Inner thought" },
    "inner",
  );
  render(
    <Reader reading={reading} insights={saved.insights} onSave={vi.fn()} />,
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: `Open saved insight: ${inner.quote.trim()}`,
    }),
  );
  expect(
    screen.getByRole("textbox", { name: "What would you like to remember?" }),
  ).toHaveValue("Inner thought");
  fireEvent.click(
    screen.getByRole("button", {
      name: `Open saved insight: ${text.slice(0, 10)}`,
    }),
  );
  expect(
    screen.getByRole("textbox", { name: "What would you like to remember?" }),
  ).toHaveValue("Outer thought");
});

it("keeps the reader position when editing a note reopened from Notepad", () => {
  const scroll = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    value: scroll,
    configurable: true,
  });
  const initial = initialLibrary();
  const reading = initial.readings[0];
  const passage = wholeParagraph(reading, 4);
  const saved = saveInsight(
    initial,
    reading.id,
    passage,
    { note: "First thought" },
    "saved",
  );
  const view = render(
    <Reader
      reading={reading}
      insights={saved.insights}
      initialInsight={saved.insights[0]}
      onSave={vi.fn()}
    />,
  );
  expect(scroll).toHaveBeenCalledTimes(1);
  const edited = saveInsight(
    saved,
    reading.id,
    passage,
    { note: "A better thought" },
    "unused",
  );
  view.rerender(
    <Reader
      reading={reading}
      insights={edited.insights}
      initialInsight={edited.insights[0]}
      onSave={vi.fn()}
    />,
  );
  expect(scroll).toHaveBeenCalledTimes(1);
});
