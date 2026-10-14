import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { initialLibrary, saveInsight, wholeParagraph } from "../reading";
import { Reader } from "./Reader";

afterEach(() => {
  cleanup();
  window.getSelection()?.removeAllRanges();
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
  fireEvent.click(screen.getByRole("button", { name: "Edit note" }));
  expect(
    screen.getByRole("textbox", { name: "Your note on the selected passage" }),
  ).toHaveValue("Inner thought");
  fireEvent.click(
    screen.getByRole("button", {
      name: `Open saved insight: ${text.slice(0, 10)}`,
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit note" }));
  expect(
    screen.getByRole("textbox", { name: "Your note on the selected passage" }),
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

const ReaderDemo = () => {
  const [state, setState] = useState(initialLibrary);
  return (
    <Reader
      reading={state.readings[0]}
      insights={state.insights}
      onSave={(passage, patch) =>
        setState((previous) =>
          saveInsight(
            previous,
            "quiet-work",
            passage,
            patch,
            crypto.randomUUID(),
          ),
        )
      }
    />
  );
};

it("starts a question by typing and keeps follow-ups in their own answer thread", () => {
  render(<ReaderDemo />);
  fireEvent.click(screen.getByRole("button", { name: "Select paragraph 1" }));
  fireEvent.keyDown(document.body, { key: "W" });
  const question = screen.getByRole("textbox", {
    name: "Your question about the selected passage",
  });
  expect(question).toHaveFocus();
  expect(question).toHaveValue("W");
  fireEvent.change(question, { target: { value: "Why does this matter?" } });
  fireEvent.click(screen.getByRole("button", { name: /^Ask$/ }));
  expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
  expect(screen.getByText("Why does this matter?")).toBeInTheDocument();
  const followUp = screen.getByRole("textbox", { name: "Ask a follow-up" });
  fireEvent.change(followUp, { target: { value: "Give me an example." } });
  fireEvent.click(screen.getByRole("button", { name: "Send follow-up" }));
  expect(screen.getByText("1 follow-up")).toBeInTheDocument();
  expect(screen.getByText("Give me an example.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Collapse note" }));
  expect(
    screen.getByRole("button", { name: "Open answer: Why does this matter?" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Select paragraph 1" }));
  fireEvent.click(screen.getByRole("button", { name: "Explain" }));
  expect(
    screen.getByRole("button", { name: "Open answer: Why does this matter?" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("article", { name: "Explain answer" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Delete question" }));
  expect(
    screen.queryByRole("article", { name: "Explain answer" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Open answer: Why does this matter?" }),
  ).toBeInTheDocument();
});

it("saves notes on Enter and outside click, cancels Escape edits, and recolors highlights", () => {
  render(<ReaderDemo />);
  fireEvent.click(screen.getByRole("button", { name: "Select paragraph 1" }));
  fireEvent.click(screen.getByRole("button", { name: "Add a note" }));
  const note = screen.getByRole("textbox", {
    name: "Your note on the selected passage",
  });
  fireEvent.change(note, { target: { value: "Remember the distinction." } });
  fireEvent.keyDown(note, { key: "Enter" });
  const savedNote = screen.getByRole("button", {
    name: "Your note: Remember the distinction.. Edit note.",
  });
  fireEvent.click(savedNote);
  const editing = screen.getByRole("textbox", {
    name: "Your note on the selected passage",
  });
  fireEvent.change(editing, { target: { value: "An unsaved change" } });
  fireEvent.keyDown(editing, { key: "Escape" });
  fireEvent.click(savedNote);
  expect(
    screen.getByRole("textbox", { name: "Your note on the selected passage" }),
  ).toHaveValue("Remember the distinction.");
  fireEvent.change(
    screen.getByRole("textbox", { name: "Your note on the selected passage" }),
    { target: { value: "A better note" } },
  );
  fireEvent.pointerDown(screen.getByRole("heading", { level: 1 }));
  expect(
    screen.getByRole("button", {
      name: "Your note: A better note. Edit note.",
    }),
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", {
      name: `Open saved insight: ${initialLibrary().readings[0].paragraphs[0].text}`,
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Blue highlight" }));
  expect(
    screen.getByRole("button", {
      name: `Open saved insight: ${initialLibrary().readings[0].paragraphs[0].text}`,
    }),
  ).toHaveAttribute("data-color", "blue");
});

it("keeps a new selection when its drag ends on an existing highlight", () => {
  const initial = initialLibrary();
  const reading = initial.readings[0];
  const passage = wholeParagraph(reading, 0);
  const state = saveInsight(
    initial,
    reading.id,
    passage,
    { note: "Context", color: "blue" },
    "saved",
  );
  render(
    <Reader reading={reading} insights={state.insights} onSave={vi.fn()} />,
  );
  const mark = screen.getByRole("button", {
    name: `Open saved insight: ${passage.quote}`,
  });
  const range = document.createRange();
  range.setStart(mark.firstChild!, 0);
  range.setEnd(mark.firstChild!, 6);
  window.getSelection()!.addRange(range);
  fireEvent.mouseUp(mark);
  fireEvent.click(mark);
  expect(screen.getByRole("button", { name: "Define" })).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Add a note" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Edit note" }),
  ).not.toBeInTheDocument();
});
