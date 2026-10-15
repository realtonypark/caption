import { Fragment, useEffect, useRef, useState } from "react";
import {
  answerThreads,
  saveInsight,
  findInsight,
  passageKey,
  passageSegments,
  wholeParagraph,
  type AnswerThread,
  type Insight,
  type InsightPatch,
  type Passage,
  type Reading,
  type ReadingAction,
  type Exchange,
} from "../reading";
import { capturePassage } from "../selection";
import { useMedia } from "../use-media";
import { Icon } from "./Icon";
import { Margin } from "./Margin";
import { SelectionLens } from "./SelectionLens";
import { AnswerCard } from "./AnswerCard";
import { QuestionComposer } from "./QuestionComposer";
import { FREE_MODELS, requestAnswer, questionFor } from "../services/ai";
import { preferredModel, keepModel } from "../services/model-preference";

interface ReaderProps {
  reading: Reading;
  insights: Insight[];
  initialInsight?: Insight;
  onSave: (passage: Passage, patch: InsightPatch) => void;
  models?: readonly { id: string; name: string }[];
}
interface LensSelection {
  passage: Passage;
  mode: "actions" | "note";
  key: string;
}
export const Reader = ({
  reading,
  insights: savedInsights,
  initialInsight,
  onSave,
  models = FREE_MODELS,
}: ReaderProps) => {
  const [pending, setPending] = useState<
    { id: string; passage: Passage; exchanges: Exchange[] } | undefined
  >();
  const requestRef = useRef<AbortController | null>(null);
  const [model, setModel] = useState(preferredModel);
  const [requestError, setRequestError] = useState("");
  const insights = pending
    ? saveInsight(
        { readings: [reading], insights: savedInsights },
        reading.id,
        pending.passage,
        {
          exchanges: pending.exchanges,
          highlighted: findInsight(savedInsights, pending.passage)
            ? (findInsight(savedInsights, pending.passage)!.highlighted ?? true)
            : false,
        },
        pending.id,
      ).insights
    : savedInsights;
  const articleRef = useRef<HTMLElement>(null);
  const composerRef = useRef<HTMLInputElement>(null);
  const [lens, setLens] = useState<LensSelection | undefined>(
    initialInsight &&
      (initialInsight.note ||
        (!initialInsight.exchanges.length &&
          initialInsight.highlighted !== false))
      ? {
          passage: initialInsight.passage,
          mode: initialInsight.note ? "note" : "actions",
          key: "initial",
        }
      : undefined,
  );
  const [activeId, setActiveId] = useState<string | undefined>(
    initialInsight && !initialInsight.note
      ? answerThreads([initialInsight]).at(-1)?.id
      : undefined,
  );
  const [hoveredId, setHoveredId] = useState<string>();
  const [cursor, setCursor] = useState<number>();
  const wide = useMedia("(min-width: 1080px)");
  const threads = answerThreads(insights);
  const activeThread = threads.find((thread) => thread.id === activeId);
  const activeThreadIndex = threads.findIndex(
    (thread) => thread.id === activeId,
  );
  const activeInsight = lens ? findInsight(insights, lens.passage) : undefined;
  const initialParagraph = initialInsight?.passage.ranges[0].paragraph;
  const openLens = (passage: Passage, mode: "actions" | "note" = "actions") => {
    setActiveId(undefined);
    setLens({ passage, mode, key: crypto.randomUUID() });
  };
  const openNote = (insight: Insight) => {
    openLens(insight.passage, "note");
    setActiveId(`note-${insight.id}`);
  };
  const openSavedInsight = (id: string) => {
    // A drag can end on a mark; its click must not replace the new selection.
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    const insight = insights.find((entry) => entry.id === id);
    if (!insight) return;
    const answers = threads.filter((thread) => thread.insightId === insight.id);
    if (answers.length) {
      const current = answers.findIndex((thread) => thread.id === activeId);
      setActiveId(
        answers[
          current < 0 ? answers.length - 1 : (current + 1) % answers.length
        ].id,
      );
      setLens(undefined);
    } else openLens(insight.passage);
  };
  const changeAnswer = (index: number) => {
    const thread = threads[index];
    if (!thread) return;
    setActiveId(thread.id);
    const paragraph = document.getElementById(
      `paragraph-${thread.passage.ranges[0].paragraph}`,
    );
    if (paragraph)
      window.scrollTo({
        top: Math.max(
          0,
          paragraph.getBoundingClientRect().top +
            window.scrollY -
            window.innerHeight * 0.22,
        ),
        behavior: "instant",
      });
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
    replace = false,
  ): Promise<boolean> => {
    if (!models.some((item) => item.id === model)) {
      setRequestError(
        "Your selected model is unavailable. Choose a reading model before asking.",
      );
      return Promise.resolve(false);
    }
    if (requestRef.current) {
      setRequestError(
        "Finish or stop the current answer before asking another question.",
      );
      return Promise.resolve(false);
    }
    const thread = threads.find((item) => item.id === threadId);
    const history =
      (replace ? thread?.exchanges.slice(0, -1) : thread?.exchanges)?.filter(
        (exchange) => exchange.status === undefined,
      ) ?? [];
    const previous = findInsight(savedInsights, passage);
    const old = previous?.exchanges ?? [];
    const removed = replace ? thread?.exchanges.at(-1) : undefined;
    const kept = old.filter((exchange) => exchange !== removed);
    const text = questionFor(action, question);
    const exchange: Exchange = {
      question: text,
      answer: "",
      paragraphs: [],
      action,
      scope,
      threadId,
      status: "pending",
    };
    let partial = "";
    const controller = new AbortController();
    requestRef.current = controller;
    setRequestError("");
    setPending({ id: threadId, passage, exchanges: [...kept, exchange] });
    setActiveId(threadId);
    setLens(undefined);
    const run = async () => {
      try {
        const answer = await requestAnswer({
          reading,
          passage,
          action,
          question: text,
          scope,
          history,
          model,
          signal: controller.signal,
          onText: (answer) => {
            partial = answer;
            setPending((value) =>
              value
                ? { ...value, exchanges: [...kept, { ...exchange, answer }] }
                : value,
            );
          },
        });
        if (controller.signal.aborted) return;
        if (replace)
          onSave(passage, {
            replaceAnswer: { threadId, exchange: { ...answer, threadId } },
          });
        else onSave(passage, { exchange: { ...answer, threadId } });
        setPending(undefined);
      } catch (error) {
        if (controller.signal.reason === "discard") return;
        const message = controller.signal.aborted
          ? "Answer stopped. You can try again."
          : error instanceof Error
            ? error.message
            : "Could not get an answer.";
        // A failed retry keeps the saved exchange; the banner shows the error.
        if (!replace)
          onSave(passage, {
            exchange: {
              ...exchange,
              answer: partial,
              status: "error",
              error: message,
            },
          });
        setPending(undefined);
        setRequestError(message);
      } finally {
        if (requestRef.current === controller) requestRef.current = null;
      }
    };
    run().catch(() => {
      setPending(undefined);
      setRequestError("Could not get an answer.");
    });
    return Promise.resolve(true);
  };
  const followUp = (thread: AnswerThread, question: string) =>
    ask(thread.passage, "ask", question, thread.id, thread.exchanges[0].scope);
  const removeThread = (thread: AnswerThread) => {
    if (answerThreads(savedInsights).some((item) => item.id === thread.id))
      onSave(thread.passage, { removeThread: thread.id });
    if (pending?.id === thread.id) {
      requestRef.current?.abort("discard");
      setPending(undefined);
    }
    setActiveId(undefined);
  };
  const retry = (thread: AnswerThread) => {
    const last = thread.exchanges.at(-1)!;
    void ask(
      thread.passage,
      last.action ?? "ask",
      last.question,
      thread.id,
      last.scope ?? "passage",
      true,
    );
  };
  useEffect(() => () => requestRef.current?.abort("discard"), []);
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
      if (event.defaultPrevented) return;
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
      {requestError && (
        <p className="reader-error" role="alert">
          {requestError}
        </p>
      )}
      {pending?.exchanges.at(-1)?.status === "pending" && (
        <button
          type="button"
          className="stop-answer"
          onClick={() => requestRef.current?.abort()}
        >
          Stop answer
        </button>
      )}
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
                  : reading.kind === "pdf"
                    ? "PDF reading"
                    : "Web reading"}
              </span>
            </div>
            <h1 tabIndex={-1}>{reading.title}</h1>
            <p className="article-description">{reading.description}</p>
            <p className="article-byline">{reading.author}</p>
            {reading.location && (
              <p className="source-location">
                {reading.location.startsWith("http") ? (
                  <a href={reading.location} target="_blank" rel="noreferrer">
                    Open original source ↗
                  </a>
                ) : (
                  reading.location
                )}
              </p>
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
                            <span
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
                              role="button"
                              tabIndex={0}
                              aria-label={`Open saved insight: ${segment.text}`}
                              onClick={() =>
                                openSavedInsight(segment.insightId!)
                              }
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  event.preventDefault();
                                  openSavedInsight(segment.insightId!);
                                }
                              }}
                            >
                              {segment.text}
                            </span>
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
          <QuestionComposer
            inputRef={composerRef}
            onAsk={(question) => {
              const paragraphs = Array.from(
                articleRef.current?.querySelectorAll<HTMLElement>(
                  "[data-paragraph]",
                ) ?? [],
              );
              const positions = paragraphs.map((paragraph) => ({
                paragraph,
                rect: paragraph.getBoundingClientRect(),
              }));
              const distance = (rect: DOMRect) =>
                Math.max(120 - rect.bottom, rect.top - window.innerHeight, 0);
              const visible =
                positions.find(
                  ({ rect }) =>
                    rect.bottom > 120 && rect.top < window.innerHeight,
                ) ??
                positions.reduce<(typeof positions)[number] | undefined>(
                  (nearest, position) =>
                    !nearest || distance(position.rect) < distance(nearest.rect)
                      ? position
                      : nearest,
                  undefined,
                );
              return ask(
                wholeParagraph(
                  reading,
                  Number(visible?.paragraph.dataset.paragraph ?? 0),
                ),
                "ask",
                question,
                undefined,
                "text",
              );
            }}
          >
            <label className="reader-model">
              <span className="sr-only">Reading model</span>
              <select
                value={model}
                onChange={(event) => {
                  setModel(event.target.value);
                  keepModel(event.target.value);
                }}
              >
                {!models.some((item) => item.id === model) && (
                  <option value={model}>
                    Selected model unavailable — choose a model
                  </option>
                )}
                {models.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </QuestionComposer>
        </article>
        {wide && (
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
        )}
      </div>
      {lens && (
        <SelectionLens
          key={lens.key}
          articleRef={articleRef}
          passage={lens.passage}
          insight={activeInsight}
          title={reading.title}
          initialMode={lens.mode}
          onSave={(patch) => onSave(lens.passage, patch)}
          onAsk={(action, question) =>
            ask(lens.passage, action, question)
          }
          onClose={() => setLens(undefined)}
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
          {threads.length > 1 && (
            <nav className="sheet-answer-navigation" aria-label="Saved answers">
              <button
                type="button"
                className="card-icon"
                aria-label="Previous answer"
                disabled={activeThreadIndex === 0}
                onClick={() => changeAnswer(activeThreadIndex - 1)}
              >
                <Icon name="back" />
              </button>
              <span>
                Answer {activeThreadIndex + 1} of {threads.length}
              </span>
              <button
                type="button"
                className="card-icon"
                aria-label="Next answer"
                disabled={activeThreadIndex === threads.length - 1}
                onClick={() => changeAnswer(activeThreadIndex + 1)}
              >
                <Icon name="arrow" />
              </button>
            </nav>
          )}
          <AnswerCard
            key={activeThread.id}
            thread={activeThread}
            active
            onActivate={() => {}}
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
