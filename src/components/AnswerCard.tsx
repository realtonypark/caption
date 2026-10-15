import { useRef, useState } from "react";
import { copyText } from "../clipboard";
import { passageLabel, READING_ACTIONS, type AnswerThread } from "../reading";
import { ExchangeView } from "./ExchangeView";
import { Icon } from "./Icon";
import { FREE_MODELS } from "../../functions/src/models.mjs";

export const AnswerCard = ({
  thread,
  active,
  onActivate,
  onCollapse,
  onAsk,
  onDelete,
  onRetry,
  onParagraph,
}: {
  thread: AnswerThread;
  active: boolean;
  onActivate: () => void;
  onCollapse?: () => void;
  onAsk: (question: string) => Promise<boolean>;
  onDelete: () => void;
  onRetry: () => void;
  onParagraph: (index: number) => void;
}) => {
  const [draft, setDraft] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const first = thread.exchanges[0];
  const label =
    first.scope === "text"
      ? "Whole text"
      : READING_ACTIONS[first.action ?? "ask"].label;
  const follow = thread.exchanges.length - 1;
  const busy = thread.exchanges.at(-1)?.status === "pending";
  if (!active)
    return (
      <button
        type="button"
        className="answer-card collapsed-answer"
        onClick={onActivate}
        aria-label={`Open answer: ${first.question}`}
      >
        <span className="collapsed-question">
          <span>
            {first.action && first.action !== "ask" ? (
              <>
                <b>{label}</b> “{thread.passage.quote}”
              </>
            ) : (
              first.question
            )}
          </span>
          {follow > 0 && <small>+{follow}</small>}
          <small>{passageLabel(thread.passage)}</small>
        </span>
        <span className="answer-gist">{first.answer}</span>
      </button>
    );
  return (
    <article
      className="answer-card active-answer"
      aria-label={`${label} answer`}
    >
      <header className="answer-card-heading">
        <b>{label}</b>
        <button
          type="button"
          className="paragraph-cite"
          aria-label={`Go to paragraph ${thread.passage.ranges[0].paragraph + 1}`}
          onClick={() => onParagraph(thread.passage.ranges[0].paragraph)}
        >
          {passageLabel(thread.passage)}
        </button>
        {follow > 0 && (
          <small>
            {follow} follow-up{follow === 1 ? "" : "s"}
          </small>
        )}
        {onCollapse && (
          <button
            type="button"
            className="card-icon collapse-answer"
            aria-label="Collapse note"
            title="Collapse · Esc"
            onClick={onCollapse}
          >
            <Icon name="collapse" />
          </button>
        )}
      </header>
      {first.action && first.action !== "ask" && (
        <blockquote>{thread.passage.quote}</blockquote>
      )}
      <div ref={bodyRef} className="answer-conversation" aria-live="polite">
        {thread.exchanges.map((exchange, index) => (
          <ExchangeView
            key={index}
            exchange={exchange}
            showQuestion={index > 0 || (first.action ?? "ask") === "ask"}
            onParagraph={onParagraph}
          />
        ))}
      </div>
      <footer className="answer-card-footer">
        <span title={thread.exchanges.at(-1)?.model}>
          {busy
            ? "Thinking…"
            : FREE_MODELS.find(
                (model) => model.id === thread.exchanges.at(-1)?.model,
              )?.name ||
              thread.exchanges.at(-1)?.model?.split("/").at(-1) ||
              "AI response"}
        </span>
        <button
          type="button"
          className="card-icon"
          aria-label="Try again"
          disabled={busy}
          title="Try again"
          onClick={() => {
            onRetry();
            bodyRef.current?.animate?.([{ opacity: 0.25 }, { opacity: 1 }], {
              duration: window.matchMedia?.("(prefers-reduced-motion: reduce)")
                .matches
                ? 0
                : 350,
            });
          }}
        >
          <Icon name="retry" />
        </button>
        <button
          type="button"
          className="card-icon"
          aria-label={copyStatus === "Copied" ? "Copied" : "Copy answer"}
          title="Copy"
          onClick={async () =>
            setCopyStatus(
              (await copyText(
                `“${thread.passage.quote}”\n\n${thread.exchanges.map((exchange) => `Q: ${exchange.question}\nA: ${exchange.answer}`).join("\n\n")}`,
              ))
                ? "Copied"
                : "Could not copy. Try again.",
            )
          }
        >
          <Icon name={copyStatus === "Copied" ? "check" : "copy"} />
        </button>
        <button
          type="button"
          className="card-icon"
          aria-label="Delete question"
          title="Delete"
          onClick={onDelete}
        >
          <Icon name="trash" />
        </button>
      </footer>
      {copyStatus && (
        <span className="copy-status" role="status">
          {copyStatus}
        </span>
      )}
      <form
        className="follow-up-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim()) {
            const submitted = draft.trim();
            void onAsk(submitted).then((accepted) => {
              if (accepted) setDraft("");
            });
          }
        }}
      >
        <input
          value={draft}
          disabled={busy}
          onChange={(event) => setDraft(event.target.value)}
          aria-label="Ask a follow-up"
          placeholder="Ask a follow-up"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              event.currentTarget.blur();
            }
          }}
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          aria-label="Send follow-up"
        >
          <Icon name="up" />
        </button>
      </form>
    </article>
  );
};
