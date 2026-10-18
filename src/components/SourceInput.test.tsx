import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SourceInput } from "./SourceInput";

afterEach(cleanup);

it("associates errors with their own source input and clears them independently", async () => {
  const add = vi.fn();
  render(<SourceInput onAdd={add} />);
  const link = screen.getByRole("textbox", { name: "Web link" });
  const file = screen.getByLabelText("Choose a file");
  fireEvent.change(file, {
    target: {
      files: [new File(["text"], "column.xlsx", { type: "text/plain" })],
    },
  });
  expect(file).toHaveAttribute("aria-invalid", "true");
  expect(file).toHaveAccessibleDescription(/Choose a PDF, Word/);
  expect(link).toHaveAttribute("aria-invalid", "false");
  expect(link).not.toHaveAccessibleDescription(/Choose a PDF, Word/);
  expect(add).not.toHaveBeenCalled();

  fireEvent.change(link, { target: { value: "javascript:alert(1)" } });
  fireEvent.click(screen.getByRole("button", { name: "Open link" }));
  expect(link).toHaveAttribute("aria-invalid", "true");
  expect(link).toHaveAccessibleDescription(/Use a link that starts with/);
  expect(file).toHaveAccessibleDescription(/Choose a PDF, Word/);

  fireEvent.change(file, {
    target: {
      files: [new File(["sample"], "reading.pdf", { type: "application/pdf" })],
    },
  });
  expect(add).toHaveBeenCalledWith("file", "reading.pdf", expect.any(File));
  await waitFor(() => expect(file).not.toBeDisabled());
  expect(file).toHaveAttribute("aria-invalid", "false");
  expect(file).not.toHaveAccessibleDescription(/Choose a PDF, Word/);
  expect(link).toHaveAccessibleDescription(/Use a link that starts with/);
});

it.each([
  "paper.pdf",
  "report.docx",
  "notes.txt",
  "notes.md",
  "screenshot.png",
  "photo.JPG",
  "scan.webp",
])("accepts %s", async (name) => {
  const add = vi.fn();
  render(<SourceInput onAdd={add} />);
  fireEvent.change(screen.getByLabelText("Choose a file"), {
    target: { files: [new File(["x"], name)] },
  });
  expect(add).toHaveBeenCalledWith("file", name, expect.any(File));
  await waitFor(() =>
    expect(screen.getByLabelText("Choose a file")).not.toBeDisabled(),
  );
});

it("explains how to open an old Word file", () => {
  render(<SourceInput onAdd={vi.fn()} />);
  const file = screen.getByLabelText("Choose a file");
  fireEvent.change(file, { target: { files: [new File(["x"], "old.doc")] } });
  expect(file).toHaveAccessibleDescription(/Save it as \.docx/);
});

it("shows why a file could not be read", async () => {
  render(
    <SourceInput onAdd={vi.fn().mockRejectedValue(new Error("Too large."))} />,
  );
  const file = screen.getByLabelText("Choose a file");
  fireEvent.change(file, { target: { files: [new File(["x"], "big.docx")] } });
  expect(await screen.findByRole("alert")).toHaveTextContent("Too large.");
  expect(file).toHaveAttribute("aria-invalid", "true");
});

it("opens a pasted screenshot but ignores pasted text", async () => {
  const add = vi.fn();
  render(<SourceInput onAdd={add} />);
  fireEvent.paste(document, { clipboardData: { files: [] } });
  expect(add).not.toHaveBeenCalled();

  fireEvent.paste(document, {
    clipboardData: {
      files: [new File(["png"], "image.png", { type: "image/png" })],
    },
  });
  expect(add).toHaveBeenCalledWith(
    "file",
    expect.stringMatching(/^Screenshot .*\.png$/),
    expect.any(File),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Choose a file")).not.toBeDisabled(),
  );
});
