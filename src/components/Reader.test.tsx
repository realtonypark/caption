import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { initialLibrary, saveInsight, wholeParagraph } from "../reading";
import { Reader } from "./Reader";

afterEach(() => {
  cleanup();
  delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});

it("keeps the reader position when editing a note reopened from Notepad", () => {
  const scroll = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    value: scroll,
    configurable: true,
  });
  const initial = initialLibrary();
  const reading = initial.readings[0];
  const passage = wholeParagraph(reading, 4);
  const saved = saveInsight(
    initial,
    reading.id,
    passage,
    { note: "First thought" },
    "saved",
  );
  const view = render(
    <Reader
      reading={reading}
      insights={saved.insights}
      initialInsight={saved.insights[0]}
      onSave={vi.fn()}
    />,
  );
  expect(scroll).toHaveBeenCalledTimes(1);
  const edited = saveInsight(
    saved,
    reading.id,
    passage,
    { note: "A better thought" },
    "unused",
  );
  view.rerender(
    <Reader
      reading={reading}
      insights={edited.insights}
      initialInsight={edited.insights[0]}
      onSave={vi.fn()}
    />,
  );
  expect(scroll).toHaveBeenCalledTimes(1);
});
