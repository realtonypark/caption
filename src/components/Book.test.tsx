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

it("offers rename and remove actions only when handlers are provided", () => {
  const reading = SAMPLE_READINGS[0];
  const { rerender } = render(
    <ul>
      <Book
        reading={reading}
        onOpen={vi.fn()}
        onRename={vi.fn()}
        onRemove={vi.fn()}
      />
    </ul>,
  );
  expect(
    screen.getByRole("button", { name: `Rename ${reading.title}` }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: `Remove ${reading.title}` }),
  ).toBeInTheDocument();
  rerender(
    <ul>
      <Book reading={reading} onOpen={vi.fn()} />
    </ul>,
  );
  expect(
    screen.queryByRole("button", { name: `Rename ${reading.title}` }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: `Remove ${reading.title}` }),
  ).not.toBeInTheDocument();
});
