import { Fragment, useEffect, useRef, useState } from "react";
import {
  answerThreads,
  demoExchange,
  findInsight,
  passageKey,
  passageSegments,
  READING_ACTIONS,
  wholeParagraph,
  type AnswerThread,
  type Insight,
  type InsightPatch,
  type Marker,
  type Passage,
  type Reading,
  type ReadingAction,
} from "../reading";
import { capturePassage } from "../selection";
import { useMedia } from "../use-media";
import { Icon } from "./Icon";
import { Margin } from "./Margin";
import { SelectionLens } from "./SelectionLens";
import { AnswerCard } from "./AnswerCard";
import { QuestionComposer } from "./QuestionComposer";

interface ReaderProps {
  reading: Reading;
  insights: Insight[];
  initialInsight?: Insight;
  onSave: (passage: Passage, patch: InsightPatch) => void;
}
interface LensSelection {
  passage: Passage;
  mode: "actions" | "note";
  key: string;
}
export const Reader = ({
  reading,
  insights,
  initialInsight,
  onSave,
}: ReaderProps) => {
  const articleRef = useRef<HTMLElement>(null);
  const composerRef = useRef<HTMLInputElement>(null);
  const [lens, setLens] = useState<LensSelection | undefined>(
    initialInsight &&
      (initialInsight.note || initialInsight.highlighted !== false)
      ? {
          passage: initialInsight.passage,
          mode: initialInsight.note ? "note" : "actions",
          key: "initial",
        }
      : undefined,
  );
  const [activeId, setActiveId] = useState<string | undefined>(
    initialInsight ? answerThreads([initialInsight])[0]?.id : undefined,
  );
  const [hoveredId, setHoveredId] = useState<string>();
  const [marker, setMarker] = useState<Marker>("yellow");
  const [web, setWeb] = useState(true);
  const [cursor, setCursor] = useState<number>();
  const wide = useMedia("(min-width: 1080px)");
  const threads = answerThreads(insights);
  const activeThread = threads.find((thread) => thread.id === activeId);
  const activeInsight = lens ? findInsight(insights, lens.passage) : undefined;
  const initialParagraph = initialInsight?.passage.ranges[0].paragraph;
  const openLens = (passage: Passage, mode: "actions" | "note" = "actions") =>
    setLens({ passage, mode, key: crypto.randomUUID() });
  const openNote = (insight: Insight) => {
    openLens(insight.passage, "note");
    setActiveId(`note-${insight.id}`);
  };
  const selectText = () => {
    if (!articleRef.current) return;
    const passage = capturePassage(articleRef.current);
    if (passage && (!lens || passageKey(lens.passage) !== passageKey(passage)))
      openLens(passage);
  };
  const goToParagraph = (index: number) =>
    document
      .getElementById(`paragraph-${index}`)
      ?.scrollIntoView({ block: "center", behavior: "instant" });
  const ask = (
    passage: Passage,
    action: ReadingAction,
    question?: string,
    threadId: string = crypto.randomUUID(),
    scope: "passage" | "text" = "passage",
  ) => {
    onSave(passage, {
      exchange: {
        ...demoExchange(
          reading,
          passage,
          question ?? READING_ACTIONS[action].question,
          action,
          scope,
        ),
        threadId,
      },
    });
    setActiveId(threadId);
    setLens(undefined);
  };
  const followUp = (thread: AnswerThread, question: string) =>
    ask(thread.passage, "ask", question, thread.id, thread.exchanges[0].scope);
  const removeThread = (thread: AnswerThread) => {
    onSave(thread.passage, { removeThread: thread.id });
    setActiveId(undefined);
  };
  const retry = (thread: AnswerThread) => {
    const insight = insights.find((entry) => entry.id === thread.insightId)!;
    const last = thread.exchanges[thread.exchanges.length - 1];
    onSave(thread.passage, {
      exchanges: insight.exchanges.map((exchange) =>
        exchange === last
          ? {
              ...demoExchange(
                reading,
                thread.passage,
                last.question,
                last.action,
                last.scope,
              ),
              threadId: thread.id,
            }
          : exchange,
      ),
    });
  };
  useEffect(() => {
    if (initialParagraph !== undefined)
      document
        .getElementById(`paragraph-${initialParagraph}`)
        ?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [initialParagraph]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const select = () => {
      clearTimeout(timer);
      timer = setTimeout(selectText, 140);
    };
    document.addEventListener("selectionchange", select);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", select);
    };
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        composerRef.current?.focus();
        return;
      }
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.isComposing ||
        (event.target as HTMLElement).closest(
          "input, textarea, select, [contenteditable]",
        ) ||
        lens
      )
        return;
      if (event.key === "/") {
        event.preventDefault();
        composerRef.current?.focus();
      } else if (event.key === "Escape") setActiveId(undefined);
      else if (event.key === "j" || event.key === "k") {
        event.preventDefault();
        const next = Math.max(
          0,
          Math.min(
            reading.paragraphs.length - 1,
            (cursor ?? (event.key === "j" ? -1 : 1)) +
              (event.key === "j" ? 1 : -1),
          ),
        );
        setCursor(next);
        goToParagraph(next);
      } else if (
        event.key === "Enter" &&
        cursor !== undefined &&
        !(event.target as HTMLElement).closest("button, a")
      ) {
        event.preventDefault();
        openLens(wholeParagraph(reading, cursor));
      } else if (event.key === "[" || event.key === "]") {
        const index = threads.findIndex((thread) => thread.id === activeId);
        const next =
          threads[
            event.key === "]"
              ? index < 0
                ? 0
                : Math.min(threads.length - 1, index + 1)
              : index < 0
                ? threads.length - 1
                : Math.max(0, index - 1)
          ];
        if (next) {
          event.preventDefault();
          setActiveId(next.id);
          goToParagraph(next.passage.ranges[0].paragraph);
        }
      }
    };
    const onDown = (event: PointerEvent) => {
      if (
        !(event.target as HTMLElement).closest(
          ".answer-card, .selection-lens, .personal-margin-note, .saved-highlight, .paragraph-number, .note-dot, .question-composer, header, aside, [role=dialog]",
        )
      )
        setActiveId(undefined);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  });
  return (
    <main id="main" className="reader-page">
      <div className="reading-layout">
        <article
          ref={articleRef}
          className="reading-article"
          onMouseUp={selectText}
          onKeyUp={selectText}
          onTouchEnd={selectText}
        >
          <header className="article-header">
            <div className="eyebrow flex items-center gap-3">
              <span>
                {reading.kind === "sample"
                  ? "Sample reading"
                  : "Sample text preview"}
              </span>
              <span aria-hidden="true">·</span>
              <span>Take your time</span>
            </div>
            <h1 tabIndex={-1}>{reading.title}</h1>
            <p className="article-description">{reading.description}</p>
            <p className="article-byline">{reading.author}</p>
            {reading.location && (
              <p className="source-location">{reading.location}</p>
            )}
            <div className="reading-instruction flex items-center gap-2">
              <Icon name="pen" />
              <span>Select a line. Make it yours.</span>
            </div>
          </header>
          <div className="article-body">
            {reading.paragraphs.map((paragraph, index) => (
              <section className="paragraph-section" key={index}>
                {paragraph.heading && <h2>{paragraph.heading}</h2>}
                <div className="paragraph-row" id={`paragraph-${index}`}>
                  <button
                    data-cursor={cursor === index}
                    type="button"
                    className="paragraph-number"
                    aria-label={`Select paragraph ${index + 1}`}
                    aria-pressed={
                      lens?.passage.ranges.some(
                        (range) => range.paragraph === index,
                      ) ?? false
                    }
                    onClick={() => {
                      window.getSelection()?.removeAllRanges();
                      openLens(wholeParagraph(reading, index));
                    }}
                  >
                    ¶{index + 1}
                  </button>
                  <p data-paragraph={index}>
                    {passageSegments(paragraph.text, index, insights).map(
                      (segment) =>
                        segment.insightId ? (
                          <Fragment key={segment.start}>
                            <button
                              className="saved-highlight"
                              data-highlighted={segment.highlighted}
                              data-color={segment.color}
                              data-has-answer={segment.hasAnswer}
                              data-active={
                                activeId === `note-${segment.insightId}` ||
                                threads.some(
                                  (thread) =>
                                    thread.insightId === segment.insightId &&
                                    thread.id === activeId,
                                )
                              }
                              data-hovered={
                                hoveredId === `note-${segment.insightId}` ||
                                threads.some(
                                  (thread) =>
                                    thread.insightId === segment.insightId &&
                                    thread.id === hoveredId,
                                )
                              }
                              onMouseEnter={() =>
                                setHoveredId(
                                  threads.find(
                                    (thread) =>
                                      thread.insightId === segment.insightId,
                                  )?.id,
                                )
                              }
                              onMouseLeave={() => setHoveredId(undefined)}
                              type="button"
                              aria-label={`Open saved insight: ${segment.text}`}
                              onClick={() => {
                                const insight = insights.find(
                                  (entry) => entry.id === segment.insightId,
                                );
                                if (!insight) return;
                                if (insight.highlighted !== false)
                                  openLens(insight.passage);
                                else {
                                  setActiveId(
                                    threads.find(
                                      (thread) =>
                                        thread.insightId === insight.id,
                                    )?.id,
                                  );
                                  setLens(undefined);
                                }
                              }}
                            >
                              {segment.text}
                            </button>
                            {segment.noteInsightId && (
                              <button
                                type="button"
                                className="note-dot"
                                aria-label={`Edit note on paragraph ${index + 1}`}
                                onClick={() => {
                                  const insight = insights.find(
                                    (entry) =>
                                      entry.id === segment.noteInsightId,
                                  );
                                  if (insight) openNote(insight);
                                }}
                              />
                            )}
                          </Fragment>
                        ) : (
                          <span key={segment.start}>{segment.text}</span>
                        ),
                    )}
                  </p>
                </div>
              </section>
            ))}
          </div>
          <footer className="article-end">
            <span aria-hidden="true">✳</span>
            <p>A good place to pause.</p>
            <span>Keep one thought. Come back for another.</span>
          </footer>
          <QuestionComposer
            inputRef={composerRef}
            onAsk={(question) => {
              const paragraphs = Array.from(
                articleRef.current?.querySelectorAll<HTMLElement>(
                  "[data-paragraph]",
                ) ?? [],
              );
              const visible = paragraphs.find(
                (paragraph) => paragraph.getBoundingClientRect().bottom > 120,
              );
              ask(
                wholeParagraph(
                  reading,
                  Number(visible?.dataset.paragraph ?? 0),
                ),
                "ask",
                question,
                undefined,
                "text",
              );
            }}
            web={web}
            onWeb={setWeb}
          />
        </article>
        <Margin
          insights={insights}
          articleRef={articleRef}
          activeId={activeId}
          onActive={setActiveId}
          onNote={openNote}
          onHover={setHoveredId}
          onAsk={followUp}
          onDelete={removeThread}
          onRetry={retry}
          onParagraph={goToParagraph}
        />
      </div>
      {lens && (
        <SelectionLens
          key={lens.key}
          articleRef={articleRef}
          passage={lens.passage}
          insight={activeInsight}
          title={reading.title}
          initialMode={lens.mode}
          marker={marker}
          onMarker={setMarker}
          onSave={(patch) => onSave(lens.passage, patch)}
          onAsk={(action, question) => ask(lens.passage, action, question)}
          onClose={() => setLens(undefined)}
          web={web}
          onWeb={setWeb}
        />
      )}
      {!wide && activeThread && (
        <aside
          className="mobile-answer-sheet"
          role="dialog"
          aria-label="Passage answer"
        >
          <div className="sheet-handle" aria-hidden="true" />
          <button
            className="sheet-close card-icon"
            type="button"
            aria-label="Close answer"
            onClick={() => setActiveId(undefined)}
          >
            <Icon name="close" />
          </button>
          <AnswerCard
            key={activeThread.id}
            thread={activeThread}
            active
            onActivate={() => {}}
            onCollapse={() => setActiveId(undefined)}
            onAsk={(question) => followUp(activeThread, question)}
            onDelete={() => removeThread(activeThread)}
            onRetry={() => retry(activeThread)}
            onParagraph={(index) => {
              setActiveId(undefined);
              goToParagraph(index);
            }}
          />
        </aside>
      )}
    </main>
  );
};
