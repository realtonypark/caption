import type { Passage, TextRange } from "./reading";

// Converts browser selection into text offsets; stored anchors never depend on DOM nodes.
export const capturePassage = (article: HTMLElement): Passage | undefined => {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (
    !article.contains(range.startContainer) ||
    !article.contains(range.endContainer)
  )
    return;
  const ranges: TextRange[] = [];
  const quotes: string[] = [];
  for (const paragraph of article.querySelectorAll<HTMLElement>(
    "[data-paragraph]",
  )) {
    if (!range.intersectsNode(paragraph)) continue;
    const text = paragraph.textContent ?? "";
    const offsetTo = (node: Node, offset: number) => {
      const prefix = document.createRange();
      prefix.selectNodeContents(paragraph);
      prefix.setEnd(node, offset);
      return prefix.toString().length;
    };
    const start = paragraph.contains(range.startContainer)
      ? offsetTo(range.startContainer, range.startOffset)
      : 0;
    const end = paragraph.contains(range.endContainer)
      ? offsetTo(range.endContainer, range.endOffset)
      : text.length;
    if (end <= start || !text.slice(start, end).trim()) continue;
    ranges.push({ paragraph: Number(paragraph.dataset.paragraph), start, end });
    quotes.push(text.slice(start, end));
  }
  return ranges.length ? { ranges, quote: quotes.join("\n\n") } : undefined;
};

// Resolves saved character offsets against the current paragraph markup.
export const passageRange = (
  article: HTMLElement,
  passage: Passage,
): Range | undefined => {
  const point = (
    paragraph: number,
    offset: number,
  ): { node: Text; offset: number } | undefined => {
    const element = article.querySelector(`[data-paragraph="${paragraph}"]`);
    if (!element) return;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode() as Text | null;
    while (node) {
      if (offset <= node.length) return { node, offset };
      offset -= node.length;
      node = walker.nextNode() as Text | null;
    }
  };
  const first = passage.ranges[0];
  const last = passage.ranges[passage.ranges.length - 1];
  const start = point(first.paragraph, first.start);
  const end = point(last.paragraph, last.end);
  if (!start || !end) return;
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
};
