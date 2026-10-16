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
  const pdf = screen.getByLabelText("Choose files");
  fireEvent.change(pdf, {
    target: {
      files: [new File(["text"], "column.csv", { type: "text/csv" })],
    },
  });
  expect(pdf).toHaveAttribute("aria-invalid", "true");
  expect(pdf).toHaveAccessibleDescription(/Choose PDF or text files/);
  expect(link).toHaveAttribute("aria-invalid", "false");
  expect(link).not.toHaveAccessibleDescription(/Choose PDF or text files/);

  fireEvent.change(link, { target: { value: "javascript:alert(1)" } });
  fireEvent.click(screen.getByRole("button", { name: "Open link" }));
  expect(link).toHaveAttribute("aria-invalid", "true");
  expect(link).toHaveAccessibleDescription(/Use a link that starts with/);
  expect(pdf).toHaveAccessibleDescription(/Choose PDF or text files/);

  const files = [
    new File(["sample"], "reading.pdf", { type: "application/pdf" }),
    new File(["notes"], "lecture.txt", { type: "text/plain" }),
  ];
  fireEvent.change(pdf, { target: { files } });
  expect(add).toHaveBeenCalledWith({
    kind: "file",
    label: "reading.pdf, lecture.txt",
    files,
  });
  await waitFor(() => expect(pdf).not.toBeDisabled());
  expect(pdf).toHaveAttribute("aria-invalid", "false");
  expect(pdf).not.toHaveAccessibleDescription(/Choose PDF or text files/);
  expect(link).toHaveAccessibleDescription(/Use a link that starts with/);
});
