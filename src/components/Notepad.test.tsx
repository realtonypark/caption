import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Notepad } from "./Notepad";
import { exportNotepad } from "../services/export";
import { initialLibrary } from "../reading";

vi.mock("../services/export", () => ({ exportNotepad: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("offers no export until there are notes", () => {
  render(<Notepad state={{ ...initialLibrary(), insights: [] }} />);
  expect(screen.queryByRole("group", { name: "Export notes" })).toBeNull();
});

it("exports the notes in the chosen format", async () => {
  vi.mocked(exportNotepad).mockResolvedValue({ replaced: 0 });
  const state = initialLibrary();
  render(<Notepad state={state} />);
  fireEvent.click(screen.getByRole("button", { name: "Export as PDF" }));
  expect(exportNotepad).toHaveBeenLastCalledWith(state, "pdf");
  await screen.findByRole("button", { name: "Export as PDF" });
  fireEvent.click(screen.getByRole("button", { name: "Export as Markdown" }));
  expect(exportNotepad).toHaveBeenLastCalledWith(state, "markdown");
  await screen.findByRole("button", { name: "Export as Markdown" });
  expect(screen.queryByRole("status")).toBeNull();
});

it("disables both buttons while a PDF is being prepared", async () => {
  let finish: (value: { replaced: number }) => void = () => {};
  vi.mocked(exportNotepad).mockReturnValue(
    new Promise((resolve) => (finish = resolve)),
  );
  render(<Notepad state={initialLibrary()} />);
  fireEvent.click(screen.getByRole("button", { name: "Export as PDF" }));
  expect(
    await screen.findByRole("button", { name: "Preparing PDF…" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Export as Markdown" }),
  ).toBeDisabled();
  finish({ replaced: 0 });
  expect(
    await screen.findByRole("button", { name: "Export as PDF" }),
  ).toBeEnabled();
});

it("tells the reader when a PDF could not draw some characters", async () => {
  vi.mocked(exportNotepad).mockResolvedValue({ replaced: 3 });
  render(<Notepad state={initialLibrary()} />);
  fireEvent.click(screen.getByRole("button", { name: "Export as PDF" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    /3 characters .* were replaced with “\?”\. Markdown keeps every character/,
  );
});

it("shows why an export failed", async () => {
  vi.mocked(exportNotepad).mockRejectedValue(new Error("Disk full."));
  render(<Notepad state={initialLibrary()} />);
  fireEvent.click(screen.getByRole("button", { name: "Export as PDF" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Disk full.");
  expect(screen.getByRole("button", { name: "Export as PDF" })).toBeEnabled();
});
