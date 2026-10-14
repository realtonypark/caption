import { useLayoutEffect, useRef, type RefObject } from "react";
import {
  answerThreads,
  passageLabel,
  type AnswerThread,
  type Insight,
} from "../reading";
import { passageRange } from "../selection";
import { placeMarginCards } from "../margin-layout";
import { AnswerCard } from "./AnswerCard";

interface MarginProps {
  insights: Insight[];
  articleRef: RefObject<HTMLElement | null>;
  activeId?: string;
  onActive: (id?: string) => void;
  onNote: (insight: Insight) => void;
  onAsk: (thread: AnswerThread, question: string) => void;
  onDelete: (thread: AnswerThread) => void;
  onRetry: (thread: AnswerThread) => void;
  onParagraph: (index: number) => void;
}

export const Margin = ({
  insights,
  articleRef,
  activeId,
  onActive,
  onNote,
  onAsk,
  onDelete,
  onRetry,
  onParagraph,
}: MarginProps) => {
  const columnRef = useRef<HTMLElement>(null);
  const threads = answerThreads(insights);
  const notes = insights.filter((insight) => insight.note);
  useLayoutEffect(() => {
    const column = columnRef.current;
    const article = articleRef.current;
    if (!column || !article) return;
    let frame = 0;
    const compute = () => {
      if (!column.offsetWidth) return;
      const base = column.getBoundingClientRect().top;
      const cards = Array.from(
        column.querySelectorAll<HTMLElement>("[data-margin-card]"),
      );
      const items = cards
        .flatMap((card) => {
          const insight = insights.find(
            (entry) => entry.id === card.dataset.insight,
          );
          if (!insight) return [];
          const range = passageRange(article, insight.passage);
          const rect =
            range?.getClientRects?.()[0] ??
            article
              .querySelector(
                `[data-paragraph="${insight.passage.ranges[0].paragraph}"]`,
              )
              ?.getBoundingClientRect();
          return rect
            ? [
                {
                  id: card.dataset.marginCard!,
                  desired: Math.max(0, rect.top - base - 6),
                  anchor: rect.top - base + rect.height / 2,
                  card,
                  mini: false,
                  height: 0,
                },
              ]
            : [];
        })
        .sort((a, b) => a.desired - b.desired);
      items.forEach((item, index) => {
        item.mini =
          item.id !== activeId &&
          !item.card.hasAttribute("data-personal-note") &&
          items.some(
            (other, otherIndex) =>
              otherIndex !== index &&
              Math.abs(other.desired - item.desired) < 88,
          );
        item.card.dataset.mini = String(item.mini);
        item.height = item.card.offsetHeight;
      });
      const tops = placeMarginCards(items, activeId);
      let height = article.offsetHeight;
      items.forEach((item) => {
        const fresh = item.card.dataset.placed !== "true";
        if (fresh) item.card.dataset.fresh = "true";
        item.card.style.setProperty(
          "--card-y",
          `${Math.round(tops[item.id])}px`,
        );
        item.card.dataset.placed = "true";
        if (fresh) {
          item.card.getBoundingClientRect();
          delete item.card.dataset.fresh;
        }
        height = Math.max(height, tops[item.id] + item.height + 32);
        const leader = item.card.querySelector<SVGPathElement>(
          ".margin-leader path",
        );
        leader?.setAttribute(
          "d",
          `M 0 ${item.anchor - tops[item.id]} C 28 ${item.anchor - tops[item.id]}, 24 17, 52 17`,
        );
      });
      const first = article
        .querySelector("[data-paragraph]")
        ?.getBoundingClientRect();
      column.style.setProperty(
        "--paper-start",
        `${Math.max(0, Math.min((first?.top ?? base) - base - 24, ...Object.values(tops).map((top) => top - 16)))}px`,
      );
      column.style.setProperty(
        "--hint-y",
        `${Math.max(0, (first?.top ?? base) - base)}px`,
      );
      column.style.setProperty("--margin-height", `${height}px`);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(compute);
    };
    compute();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(schedule)
        : undefined;
    observer?.observe(article);
    column
      .querySelectorAll<HTMLElement>("[data-margin-card]")
      .forEach((card) => observer?.observe(card));
    window.addEventListener("resize", schedule);
    document.fonts?.ready.then(schedule);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, [insights, articleRef, activeId]);
  return (
    <aside
      ref={columnRef}
      className="reading-margin"
      aria-label="Passage notes"
      id="margin"
    >
      <div className="margin-paper" aria-hidden="true" />
      {!threads.length && !notes.length && (
        <div className="margin-empty">
          <p>This area is for notes.</p>
          <p>Select any passage, then just start typing to ask.</p>
        </div>
      )}
      {threads.map((thread) => (
        <div
          key={thread.id}
          className="margin-position"
          data-margin-card={thread.id}
          data-insight={thread.insightId}
          data-active={thread.id === activeId}
        >
          <svg className="margin-leader" aria-hidden="true">
            <path />
          </svg>
          <AnswerCard
            thread={thread}
            active={thread.id === activeId}
            onActivate={() => onActive(thread.id)}
            onCollapse={() => onActive()}
            onAsk={(question) => onAsk(thread, question)}
            onDelete={() => onDelete(thread)}
            onRetry={() => onRetry(thread)}
            onParagraph={onParagraph}
          />
        </div>
      ))}
      {notes.map((insight) => (
        <div
          key={`note-${insight.id}`}
          className="margin-position"
          data-margin-card={`note-${insight.id}`}
          data-insight={insight.id}
          data-personal-note
          data-active={`note-${insight.id}` === activeId}
        >
          <svg className="margin-leader" aria-hidden="true">
            <path />
          </svg>
          <button
            type="button"
            className="personal-margin-note"
            data-color={insight.color ?? "yellow"}
            onClick={() => onNote(insight)}
            aria-label={`Your note: ${insight.note}. Edit note.`}
          >
            <span>{insight.note}</span>
            <small>{passageLabel(insight.passage)}</small>
          </button>
        </div>
      ))}
    </aside>
  );
};
