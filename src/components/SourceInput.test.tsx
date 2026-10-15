import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SourceInput } from "./SourceInput";

afterEach(cleanup);

it("associates errors with their own source input and clears them independently", () => {
  const add = vi.fn();
  render(<SourceInput onAdd={add} />);
  const link = screen.getByRole("textbox", { name: "Web link" });
  const pdf = screen.getByLabelText("Choose a PDF");
  fireEvent.change(pdf, {
    target: {
      files: [new File(["text"], "column.txt", { type: "text/plain" })],
    },
  });
  expect(pdf).toHaveAttribute("aria-invalid", "true");
  expect(pdf).toHaveAccessibleDescription(/Choose a PDF file/);
  expect(link).toHaveAttribute("aria-invalid", "false");
  expect(link).not.toHaveAccessibleDescription(/Choose a PDF file/);

  fireEvent.change(link, { target: { value: "javascript:alert(1)" } });
  fireEvent.click(screen.getByRole("button", { name: "Open link" }));
  expect(link).toHaveAttribute("aria-invalid", "true");
  expect(link).toHaveAccessibleDescription(/Use a link that starts with/);
  expect(pdf).toHaveAccessibleDescription(/Choose a PDF file/);

  fireEvent.change(pdf, {
    target: {
      files: [new File(["sample"], "reading.pdf", { type: "application/pdf" })],
    },
  });
  expect(add).toHaveBeenCalledWith("pdf", "reading.pdf");
  expect(pdf).toHaveAttribute("aria-invalid", "false");
  expect(pdf).not.toHaveAccessibleDescription(/Choose a PDF file/);
  expect(link).toHaveAccessibleDescription(/Use a link that starts with/);
});
