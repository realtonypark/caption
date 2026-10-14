import { useState, type FormEvent } from "react";
import {
  passageLabel,
  type Exchange,
  type Insight,
  type Passage,
} from "../reading";
import { ExchangeView } from "./ExchangeView";
import { Icon } from "./Icon";
import { Link } from "./Link";

interface MarginProps {
  passage?: Passage;
  insight?: Insight;
  onSave: (patch: { note?: string; exchange?: Exchange }) => void;
  onAsk: (question: string) => void;
  onParagraph: (index: number) => void;
}

export const Margin = ({
  passage,
  insight,
  onSave,
  onAsk,
  onParagraph,
}: MarginProps) => {
  const [question, setQuestion] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!question.trim()) return;
    onAsk(question.trim());
    setQuestion("");
  };
  return (
    <aside
      className="reading-margin"
      id="margin"
      aria-labelledby="margin-title"
    >
      <div className="margin-heading flex items-baseline justify-between">
        <h2 id="margin-title">Your margin</h2>
        <Icon name="pen" />
      </div>
      {!passage ? (
        <div className="margin-empty">
          <span className="handwritten-arrow" aria-hidden="true">
            ↖
          </span>
          <h3>A thought starts with a line.</h3>
          <p>
            Select a passage to ask a question, highlight it, or leave yourself
            a note.
          </p>
          <p className="margin-tip">You can also choose a paragraph number.</p>
        </div>
      ) : (
        <>
          <div className="selected-passage">
            <div className="eyebrow flex items-center justify-between">
              <span>Selected passage</span>
              <span>{passageLabel(passage)}</span>
            </div>
            <blockquote>{passage.quote}</blockquote>
            <button
              type="button"
              className="highlight-action flex items-center gap-2"
              onClick={() => onSave({})}
              disabled={!!insight}
            >
              <Icon name={insight ? "check" : "pen"} />
              {insight ? "Highlight saved" : "Keep this highlight"}
            </button>
          </div>
          <section className="margin-card ai-card" aria-labelledby="ai-title">
            <div className="flex items-center justify-between">
              <h3 id="ai-title">A little help</h3>
              <Icon name="spark" />
            </div>
            <p className="card-hint">Ask about this passage.</p>
            <div className="exchange-list" aria-live="polite">
              {insight?.exchanges.map((exchange, index) => (
                <ExchangeView
                  key={index}
                  exchange={exchange}
                  onParagraph={onParagraph}
                />
              ))}
            </div>
            <form onSubmit={submit} className="question-form">
              <label className="sr-only" htmlFor="question">
                Question about the passage
              </label>
              <textarea
                id="question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={2}
                placeholder="What does this mean?"
                required
              />
              <div className="flex items-center justify-between">
                <span className="sample-label">Demo answers</span>
                <button
                  type="submit"
                  className="ask-button flex items-center gap-2"
                  disabled={!question.trim()}
                >
                  Ask AI
                  <Icon name="arrow" />
                </button>
              </div>
            </form>
          </section>
          <section
            className="margin-card note-card"
            aria-labelledby="note-title"
          >
            <div className="flex items-center justify-between">
              <h3 id="note-title">In your own words</h3>
              <Icon name="pen" />
            </div>
            <label htmlFor="personal-note" className="card-hint">
              What would you like to remember?
            </label>
            <textarea
              id="personal-note"
              value={insight?.note ?? ""}
              onChange={(event) => onSave({ note: event.target.value })}
              rows={4}
              placeholder="An insight, a question, a connection…"
            />
            <p className="note-status flex items-center gap-2" role="status">
              {insight ? (
                <>
                  <Icon name="check" />
                  Kept in your Notepad
                </>
              ) : (
                "Your note saves as you write."
              )}
            </p>
          </section>
          <Link
            className="notepad-shortcut flex items-center justify-between"
            href="/notepad"
          >
            <span>See it in your Notepad</span>
            <Icon name="arrow" />
          </Link>
        </>
      )}
    </aside>
  );
};
