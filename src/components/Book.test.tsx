import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SAMPLE_READINGS } from "../reading";
import { Book } from "./Book";

afterEach(cleanup);

it("exposes the author and description alongside the book's accessible name", () => {
  const reading = SAMPLE_READINGS[0];
  render(
    <ul>
      <Book reading={reading} onOpen={vi.fn()} />
    </ul>,
  );
  expect(
    screen.getByRole("button", { name: `Read ${reading.title}` }),
  ).toHaveAccessibleDescription(`${reading.author}. ${reading.description}`);
});
