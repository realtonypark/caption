import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SAMPLE_READINGS, makePreview } from "../reading";
import { Library } from "./Library";

afterEach(cleanup);

it("keeps tutorials on a protected shelf and actions on user readings", () => {
  const tutorial = SAMPLE_READINGS[0];
  const mine = makePreview("pdf-1", "pdf", "2_Brains.pdf", 3);
  const onRename = vi.fn();
  render(
    <Library
      readings={[tutorial, mine]}
      onAdd={vi.fn()}
      onOpen={vi.fn()}
      onRename={onRename}
      onShelf={vi.fn()}
      onRemove={vi.fn()}
    />,
  );
  const tutorials = screen.getByRole("region", { name: "Tutorials" });
  expect(tutorials).toHaveTextContent(tutorial.title);
  expect(
    screen.queryByRole("button", { name: `Remove ${tutorial.title}` }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: `Rename ${mine.title}` }));
  expect(onRename).toHaveBeenCalledWith(mine.id);
  expect(
    screen.getByRole("button", { name: `Remove ${mine.title}` }),
  ).toBeInTheDocument();
});

it("groups user readings by shelf and re-shelves from the book row", () => {
  const general = makePreview("pdf-1", "pdf", "a.pdf", 0);
  const shelved = {
    ...makePreview("pdf-2", "pdf", "b.pdf", 1),
    shelf: "Papers",
  };
  const onShelf = vi.fn();
  render(
    <Library
      readings={[general, shelved]}
      onAdd={vi.fn()}
      onOpen={vi.fn()}
      onRename={vi.fn()}
      onShelf={onShelf}
      onRemove={vi.fn()}
    />,
  );
  expect(screen.getByRole("heading", { name: "General" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Papers" })).toBeInTheDocument();
  fireEvent.change(
    screen.getByRole("combobox", { name: `Shelf for ${general.title}` }),
    { target: { value: "Papers" } },
  );
  expect(onShelf).toHaveBeenCalledWith(general.id, "Papers");
  fireEvent.change(
    screen.getByRole("combobox", { name: `Shelf for ${shelved.title}` }),
    { target: { value: "" } },
  );
  expect(onShelf).toHaveBeenCalledWith(shelved.id, undefined);
});
