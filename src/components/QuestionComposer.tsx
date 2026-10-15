import { useState, type RefObject, type ReactNode } from "react";
import { ARTICLE_QUESTIONS } from "../reading";
import { Icon } from "./Icon";

export const QuestionComposer = ({
  inputRef,
  onAsk,
  children,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  onAsk: (question: string) => void;
  children: ReactNode;
}) => {
  const [question, setQuestion] = useState("");
  const [focused, setFocused] = useState(false);
  const ask = (text: string) => {
    if (!text.trim()) return;
    onAsk(text.trim());
    setQuestion("");
    inputRef.current?.blur();
  };
  return (
    <div className="question-composer">
      {focused && !question && (
        <div className="composer-starters">
          {ARTICLE_QUESTIONS.map((text) => (
            <button
              key={text}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => ask(text)}
            >
              {text}
            </button>
          ))}
        </div>
      )}
      <div className="composer-panel">
        <form
          className="composer-form"
          onSubmit={(event) => {
            event.preventDefault();
            ask(question);
          }}
        >
          <input
            ref={inputRef}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Escape") {
                event.stopPropagation();
                inputRef.current?.blur();
              }
            }}
            placeholder="Ask about the whole text"
            aria-label="Ask anything about the whole text"
          />
          {!focused && !question && <kbd>/</kbd>}
          <button
            type="submit"
            className="composer-send"
            disabled={!question.trim()}
            aria-label="Ask about the whole text"
          >
            <Icon name="up" />
          </button>
        </form>
        <div className="composer-toolbar">
          {children}
          <span className="composer-demo">
            AI can make mistakes. Check the source.
          </span>
        </div>
      </div>
    </div>
  );
};
