import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SAMPLE_READINGS, makePreview } from "../reading";
import { Library } from "./Library";

afterEach(cleanup);

it("keeps every reading on one shelf with rename and remove actions", () => {
  const sample = SAMPLE_READINGS[0];
  const mine = makePreview("pdf-1", "pdf", "2_Brains.pdf", 3);
  const onRename = vi.fn();
  const onRemove = vi.fn();
  render(
    <Library
      readings={[sample, mine]}
      onAdd={vi.fn()}
      onOpen={vi.fn()}
      onRename={onRename}
      onRemove={onRemove}
    />,
  );
  expect(
    screen.queryByRole("region", { name: "Tutorials" }),
  ).not.toBeInTheDocument();
  const shelf = screen.getByRole("region", { name: "Your library" });
  expect(shelf).toHaveTextContent(sample.title);
  expect(shelf).toHaveTextContent(mine.title);
  fireEvent.click(
    screen.getByRole("button", { name: `Rename ${sample.title}` }),
  );
  expect(onRename).toHaveBeenCalledWith(sample.id);
  fireEvent.click(
    screen.getByRole("button", { name: `Remove ${sample.title}` }),
  );
  expect(onRemove).toHaveBeenCalledWith(sample.id);
  fireEvent.click(screen.getByRole("button", { name: `Rename ${mine.title}` }));
  expect(onRename).toHaveBeenCalledWith(mine.id);
  expect(
    screen.getByRole("button", { name: `Remove ${mine.title}` }),
  ).toBeInTheDocument();
});
