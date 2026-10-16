import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Insight } from "../reading";
import { SelectionLens } from "./SelectionLens";

afterEach(cleanup);

const passage = {
  quote: "hello world",
  ranges: [{ paragraph: 0, start: 0, end: 11 }],
};
const articleRef = { current: null };
const renderLens = (insight?: Insight, initialMode?: "actions" | "note") => {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <SelectionLens
      articleRef={articleRef}
      passage={passage}
      insight={insight}
      title="Test"
      initialMode={initialMode}
      onSave={onSave}
      onAsk={vi.fn()}
      onClose={onClose}
    />,
  );
  return { onSave, onClose };
};
const saved = (patch: Partial<Insight> = {}): Insight => ({
  id: "insight-1",
  readingId: "reading-1",
  passage,
  note: "",
  exchanges: [],
  highlighted: true,
  color: "yellow",
  ...patch,
});

it("highlights a fresh passage in the chosen color", () => {
  const { onSave, onClose } = renderLens();
  fireEvent.click(screen.getByRole("button", { name: "Highlight in green" }));
  expect(onSave).toHaveBeenCalledWith({ highlighted: true, color: "green" });
  expect(onClose).toHaveBeenCalled();
});

it("keeps the note when its highlight is removed or recolored", () => {
  const { onSave } = renderLens(saved({ note: "Keep me" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Change highlight to blue" }),
  );
  expect(onSave).toHaveBeenCalledWith({ highlighted: true, color: "blue" });
  fireEvent.click(screen.getByRole("button", { name: "Remove highlight" }));
  expect(onSave).toHaveBeenCalledWith({ highlighted: false });
});

it("deletes only the note from the note editor", () => {
  const { onSave } = renderLens(saved({ note: "Drop me" }), "note");
  fireEvent.click(screen.getByRole("button", { name: "Delete note" }));
  expect(onSave).toHaveBeenCalledWith({ note: "" });
  cleanup();
  renderLens(saved(), "note");
  expect(
    screen.queryByRole("button", { name: "Delete note" }),
  ).not.toBeInTheDocument();
});
