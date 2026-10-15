import { afterEach, expect, it } from "vitest";
import { capturePassage } from "./selection";

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

it("anchors a selection across rendered highlights and paragraphs without including headings", () => {
  const article = document.createElement("article");
  article.innerHTML =
    '<p data-paragraph="0">A <button>saved</button> line.</p><h2>Another thought</h2><p data-paragraph="1">A second passage.</p>';
  document.body.append(article);
  const range = document.createRange();
  range.setStart(article.querySelector("button")!.firstChild!, 1);
  range.setEnd(article.querySelector('[data-paragraph="1"]')!.firstChild!, 8);
  window.getSelection()!.addRange(range);
  expect(capturePassage(article)).toEqual({
    quote: "aved line.\n\nA second",
    ranges: [
      { paragraph: 0, start: 3, end: 13 },
      { paragraph: 1, start: 0, end: 8 },
    ],
  });
});
