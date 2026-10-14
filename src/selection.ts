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
