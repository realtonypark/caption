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
