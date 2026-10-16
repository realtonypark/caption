import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {
  SAMPLE_READINGS,
  wholeParagraph,
  type LibraryState,
} from "../reading";
import { Notepad } from "./Notepad";

afterEach(cleanup);

const state = (): LibraryState => {
  const first = SAMPLE_READINGS[0];
  const second = SAMPLE_READINGS[1];
  return {
    readings: [first, second],
    insights: [
      {
        id: "insight-1",
        readingId: first.id,
        passage: wholeParagraph(first, 0),
        note: "A kept thought",
        exchanges: [],
      },
    ],
  };
};

it("filters to one reading with a way back when ?reading is set", () => {
  window.history.pushState({}, "", `/notepad?reading=${SAMPLE_READINGS[0].id}`);
  render(<Notepad state={state()} />);
  expect(screen.getByText(/Notes from/)).toHaveTextContent(
    SAMPLE_READINGS[0].title,
  );
  expect(screen.getByRole("link", { name: "Back to reading" })).toHaveAttribute(
    "href",
    `/read/${SAMPLE_READINGS[0].id}`,
  );
  expect(screen.getByRole("link", { name: "All notes" })).toHaveAttribute(
    "href",
    "/notepad",
  );
  expect(
    screen.queryByRole("heading", { name: SAMPLE_READINGS[1].title }),
  ).not.toBeInTheDocument();
  window.history.pushState({}, "", "/");
});

it("shows every reading without a filter", () => {
  window.history.pushState({}, "", "/notepad");
  render(<Notepad state={state()} />);
  expect(screen.queryByText(/Notes from/)).not.toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: SAMPLE_READINGS[0].title }),
  ).toBeInTheDocument();
  window.history.pushState({}, "", "/");
});
