import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  initialLibrary,
  saveInsight,
  wholeParagraph,
  demoExchange,
} from "../reading";
import { Reader } from "./Reader";
import { requestAnswer } from "../services/ai";

const emptyLibrary = (): ReturnType<typeof initialLibrary> => ({
  ...initialLibrary(),
  insights: [],
});

vi.mock("../services/ai", async () => {
  const { demoExchange, READING_ACTIONS } = await import("../reading");
  const { FREE_MODELS } = await import("../../functions/src/models.mjs");
  return {
    FREE_MODELS,
    questionFor: (action: keyof typeof READING_ACTIONS, question?: string) =>
      question || READING_ACTIONS[action].question,
    requestAnswer: vi.fn(async (options) => ({
      ...demoExchange(
        options.reading,
        options.passage,
        options.question,
        options.action,
        options.scope,
      ),
      model: options.model,
    })),
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.getSelection()?.removeAllRanges();
  delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});

it("keeps an unavailable personal model explicit and does not send a question to another model", () => {
  localStorage.setItem(
    "caption:reading-model",
    "removed-connection::private-model",
  );
  vi.mocked(requestAnswer).mockClear();
  const save = vi.fn();
  try {
    render(
      <Reader
        reading={initialLibrary().readings[0]}
        insights={[]}
        onSave={save}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Reading model" })).toHaveValue(
      "removed-connection::private-model",
    );
    expect(
      screen.getByRole("option", { name: /Selected model unavailable/ }),
    ).toBeInTheDocument();
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Ask anything about the whole text",
      }),
      { target: { value: "Why?" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Ask about the whole text" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your selected model is unavailable",
    );
    expect(requestAnswer).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  } finally {
    localStorage.removeItem("caption:reading-model");
  }
});

it("opens the nested note from its highlight while keeping the outer note reachable", () => {
  const initial = emptyLibrary();
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
  const initial = emptyLibrary();
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
  const [state, setState] = useState(emptyLibrary);
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

it("starts a question by typing and keeps follow-ups in their own answer thread", async () => {
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
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Stop answer" }),
    ).not.toBeInTheDocument(),
  );
  const followUp = screen.getByRole("textbox", { name: "Ask a follow-up" });
  fireEvent.change(followUp, { target: { value: "Give me an example." } });
  fireEvent.click(screen.getByRole("button", { name: "Send follow-up" }));
  expect(screen.getByText("1 follow-up")).toBeInTheDocument();
  expect(screen.getByText("Give me an example.")).toBeInTheDocument();
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Stop answer" }),
    ).not.toBeInTheDocument(),
  );
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
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Stop answer" }),
    ).not.toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Delete question" }));
  expect(
    screen.queryByRole("article", { name: "Explain answer" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Open answer: Why does this matter?" }),
  ).toBeInTheDocument();
});

it("highlights without a note, saves notes, and cancels Escape edits", () => {
  render(<ReaderDemo />);
  fireEvent.click(screen.getByRole("button", { name: "Select paragraph 1" }));
  fireEvent.click(screen.getByRole("button", { name: "Highlight in yellow" }));
  const highlighted = screen.getByRole("button", {
    name: `Open saved insight: ${initialLibrary().readings[0].paragraphs[0].text}`,
  });
  expect(highlighted).toHaveAttribute("data-color", "yellow");
  expect(
    screen.queryByRole("textbox", { name: "Your note on the selected passage" }),
  ).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Select paragraph 1" }));
  fireEvent.click(screen.getByRole("button", { name: "Note" }));
  const note = screen.getByRole("textbox", {
    name: "Your note on the selected passage",
  });
  fireEvent.change(note, { target: { value: "Remember the distinction." } });
  fireEvent.keyDown(note, { key: "Enter" });
  const savedNote = screen.getByRole("button", {
    name: "Your note: Remember the distinction.. Edit note.",
  });
  expect(savedNote).toHaveAttribute("data-color", "yellow");
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
  expect(screen.queryByRole("button", { name: /highlight in/i })).toBeNull();
});

it("keeps a new selection when its drag ends on an existing highlight", () => {
  const initial = emptyLibrary();
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
    screen.getByRole("button", { name: "Note" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Edit note" }),
  ).not.toBeInTheDocument();
});

it("opens highlighted answers on mobile and keeps every thread and personal note reachable", () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const initial = emptyLibrary();
  const reading = initial.readings[0];
  const passage = wholeParagraph(reading, 0);
  let state = saveInsight(
    initial,
    reading.id,
    passage,
    { note: "Context", color: "green" },
    "saved",
  );
  state = saveInsight(
    state,
    reading.id,
    passage,
    {
      exchange: {
        ...demoExchange(reading, passage, "First question?"),
        threadId: "first",
      },
    },
    "unused",
  );
  state = saveInsight(
    state,
    reading.id,
    passage,
    {
      exchange: {
        ...demoExchange(reading, passage, "Second question?"),
        threadId: "second",
      },
    },
    "unused",
  );
  render(
    <Reader reading={reading} insights={state.insights} onSave={vi.fn()} />,
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: `Open saved insight: ${passage.quote}`,
    }),
  );
  expect(
    screen.getByRole("dialog", { name: "Passage answer" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Second question?")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Previous answer" }));
  expect(screen.getByText("First question?")).toBeInTheDocument();
  const text = screen.getByRole("button", {
    name: `Open saved insight: ${passage.quote}`,
  });
  const range = document.createRange();
  range.setStart(text.firstChild!, 0);
  range.setEnd(text.firstChild!, 6);
  window.getSelection()!.addRange(range);
  fireEvent.mouseUp(text);
  expect(screen.getByRole("toolbar")).toBeInTheDocument();
  expect(
    screen.queryByRole("dialog", { name: "Passage answer" }),
  ).not.toBeInTheDocument();
  window.getSelection()!.removeAllRanges();
  fireEvent.keyDown(document.body, { key: "Escape" });
  fireEvent.click(text);
  fireEvent.click(screen.getByRole("button", { name: "Close answer" }));
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    value: vi.fn(),
    configurable: true,
  });
  fireEvent.keyDown(document.body, { key: "j" });
  fireEvent.keyDown(
    screen.getByRole("button", {
      name: `Open saved insight: ${passage.quote}`,
    }),
    { key: "Enter" },
  );
  expect(
    screen.getByRole("dialog", { name: "Passage answer" }),
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Edit note on paragraph 1" }),
  );
  expect(
    screen.getByRole("textbox", { name: "Your note on the selected passage" }),
  ).toHaveValue("Context");
});

it("keeps note and question editors open when Escape dismisses an IME candidate", () => {
  render(<ReaderDemo />);
  fireEvent.click(screen.getByRole("button", { name: "Select paragraph 1" }));
  fireEvent.click(screen.getByRole("button", { name: "Note" }));
  const note = screen.getByRole("textbox", {
    name: "Your note on the selected passage",
  });
  fireEvent.change(note, { target: { value: "생각" } });
  fireEvent.keyDown(note, { key: "Escape", isComposing: true });
  expect(note).toHaveFocus();
  expect(note).toHaveValue("생각");
  fireEvent.keyDown(note, { key: "Enter", isComposing: true });
  expect(note).toBeInTheDocument();
  fireEvent.keyDown(note, { key: "Escape" });
  expect(note).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Select paragraph 1" }));
  fireEvent.click(screen.getByRole("button", { name: /^Ask$/ }));
  const question = screen.getByRole("textbox", {
    name: "Your question about the selected passage",
  });
  fireEvent.change(question, { target: { value: "질문" } });
  fireEvent.keyDown(question, { key: "Escape", isComposing: true });
  expect(question).toHaveFocus();
  expect(question).toHaveValue("질문");
  fireEvent.keyDown(question, { key: "Escape" });
  expect(question).not.toBeInTheDocument();
  const composer = screen.getByRole("textbox", {
    name: "Ask anything about the whole text",
  });
  fireEvent.keyDown(document.body, { key: "/" });
  fireEvent.change(composer, { target: { value: "Draft question" } });
  fireEvent.keyDown(composer, { key: "Escape", isComposing: true });
  expect(composer).toHaveFocus();
  fireEvent.keyDown(composer, { key: "Escape" });
  expect(composer).not.toHaveFocus();
  fireEvent.keyDown(document.body, { key: "/" });
  expect(composer).toHaveValue("Draft question");
});

it("anchors whole-text answers to a visible paragraph or the nearest offscreen one", async () => {
  const reading = initialLibrary().readings[0];
  const save = vi.fn();
  const view = render(<Reader reading={reading} insights={[]} onSave={save} />);
  const paragraphs = view.container.querySelectorAll("[data-paragraph]");
  const rect = (top: number, bottom: number) => ({ top, bottom }) as DOMRect;
  paragraphs.forEach((paragraph, index) => {
    vi.spyOn(paragraph, "getBoundingClientRect").mockReturnValue(
      index === 1
        ? rect(200, 300)
        : rect(1200 + index * 100, 1300 + index * 100),
    );
  });
  const composer = screen.getByRole("textbox", {
    name: "Ask anything about the whole text",
  });
  fireEvent.change(composer, { target: { value: "What matters here?" } });
  fireEvent.click(
    screen.getByRole("button", { name: "Ask about the whole text" }),
  );
  await waitFor(() =>
    expect(save.mock.calls[0]?.[0].ranges[0].paragraph).toBe(1),
  );
  paragraphs.forEach((paragraph, index) => {
    vi.mocked(paragraph.getBoundingClientRect).mockReturnValue(
      rect(-1000 + index * 100, -900 + index * 100),
    );
  });
  fireEvent.change(composer, { target: { value: "And the conclusion?" } });
  fireEvent.click(
    screen.getByRole("button", { name: "Ask about the whole text" }),
  );
  await waitFor(() =>
    expect(save.mock.calls[1]?.[0].ranges[0].paragraph).toBe(
      paragraphs.length - 1,
    ),
  );
});
