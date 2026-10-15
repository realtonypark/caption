import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  isShortSelection,
  passageLabel,
  READING_ACTIONS,
  type Insight,
  type InsightPatch,
  type Passage,
  type ReadingAction,
} from "../reading";
import { passageRange } from "../selection";
import { copyText } from "../clipboard";
import { Icon } from "./Icon";

type Mode = "actions" | "ask" | "note";
const ACTION_ICONS = {
  explain: "lightbulb",
  define: "define",
  simplify: "simplify",
  check: "check",
  connect: "related",
  counter: "scale",
} as const;
const STARTERS = {
  word: [
    "Why this word here?",
    "Where does it come from?",
    "Use it in a sentence",
  ],
  passage: [
    "Give me an example",
    "Why does it matter?",
    "What is the evidence?",
  ],
};

export const SelectionLens = ({
  articleRef,
  passage,
  insight,
  title,
  initialMode = "actions",
  onSave,
  onAsk,
  onClose,
}: {
  articleRef: RefObject<HTMLElement | null>;
  passage: Passage;
  insight?: Insight;
  title: string;
  initialMode?: Mode;
  onSave: (patch: InsightPatch) => void;
  onAsk: (action: ReadingAction, question?: string) => Promise<boolean>;
  onClose: () => void;
}) => {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [draft, setDraft] = useState(
    initialMode === "note" ? (insight?.note ?? "") : "",
  );
  const [menu, setMenu] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const existing = insight && insight.highlighted !== false;
  const short = isShortSelection(passage.quote);
  const primary: ReadingAction[] = ["explain", short ? "define" : "simplify"];
  const more: ReadingAction[] = [
    short ? "simplify" : "define",
    "check",
    "connect",
    "counter",
  ];
  const close = () => {
    window.getSelection()?.removeAllRanges();
    onClose();
  };
  const keepNote = () => {
    if (draft.trim() || insight?.note)
      onSave({
        note: draft.trim(),
        highlighted: true,
      });
  };
  const toAsk = (text = "") => {
    setDraft(text);
    setMode("ask");
    setMenu(false);
    window.getSelection()?.removeAllRanges();
  };
  const toNote = () => {
    setDraft(insight?.note ?? "");
    setMode("note");
    setMenu(false);
    window.getSelection()?.removeAllRanges();
  };
  const run = (action: ReadingAction, question?: string) => {
    void onAsk(action, question).then((accepted) => {
      if (accepted) close();
    });
  };

  useLayoutEffect(() => {
    const box = boxRef.current;
    const article = articleRef.current;
    if (!box || !article) return;
    let idealX: number | undefined;
    const place = () => {
      const range = passageRange(article, passage);
      const rects = range?.getClientRects
        ? Array.from(range.getClientRects()).filter((rect) => rect.width > 0)
        : [];
      const first =
        rects[0] ??
        article
          .querySelector(`[data-paragraph="${passage.ranges[0].paragraph}"]`)
          ?.getBoundingClientRect();
      if (!first) return;
      const last = rects[rects.length - 1] ?? first;
      const viewportWidth =
        document.documentElement.clientWidth || window.innerWidth;
      const width = box.offsetWidth;
      const height = box.offsetHeight;
      const viewport = window.visualViewport;
      const bottom = viewport
        ? viewport.offsetTop + viewport.height
        : window.innerHeight;
      const coarse = window.matchMedia?.("(pointer: coarse)").matches;
      const docked = !!coarse && mode === "actions" && !existing;
      let below = coarse || first.top - height - 12 < 64;
      if (below && last.bottom + height + 12 > bottom - 8) below = false;
      idealX ??= (first.left + first.right - width) / 2;
      const x = Math.max(12, Math.min(viewportWidth - width - 12, idealX));
      const y = docked
        ? bottom - height - 16
        : Math.max(
            12,
            Math.min(
              bottom - height - 12,
              below ? last.bottom + 12 : first.top - height - 12,
            ),
          );
      box.style.setProperty("--lens-x", `${x}px`);
      box.style.setProperty("--lens-y", `${y}px`);
      box.style.setProperty(
        "--lens-arrow",
        `${Math.max(16, Math.min(width - 16, (first.left + first.right) / 2 - x))}px`,
      );
      box.dataset.side = below ? "below" : "above";
      box.dataset.docked = String(docked);
      document.documentElement.toggleAttribute("data-lens-docked", docked);
    };
    place();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(place)
        : undefined;
    observer?.observe(box);
    window.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    window.visualViewport?.addEventListener("resize", place);
    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("resize", place);
      document.documentElement.removeAttribute("data-lens-docked");
    };
  }, [articleRef, passage, mode, existing]);

  useLayoutEffect(() => {
    const input =
      mode === "ask"
        ? inputRef.current
        : mode === "note"
          ? noteRef.current
          : null;
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  }, [mode]);
  useLayoutEffect(() => {
    const note = noteRef.current;
    if (note) {
      note.style.setProperty("--note-height", "auto");
      note.style.setProperty(
        "--note-height",
        `${Math.min(168, note.scrollHeight)}px`,
      );
    }
  }, [draft, mode]);

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (boxRef.current?.contains(event.target as Node)) return;
      if (mode === "note") keepNote();
      onClose();
    };
    const key = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing)
        return;
      if (
        (event.target as HTMLElement).closest(
          "input, textarea, [contenteditable]",
        )
      )
        return;
      if (
        event.key === "Enter" &&
        (event.target as HTMLElement).closest("button")
      )
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (menu) setMenu(false);
        else close();
      } else if (
        mode === "actions" &&
        (event.key === "Enter" || (event.key.length === 1 && event.key !== " "))
      ) {
        event.preventDefault();
        event.stopPropagation();
        toAsk(event.key === "Enter" ? "" : event.key);
      }
    };
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("keydown", key, true);
    };
  });

  const actionButton = (action: ReadingAction, inMenu = false) => (
    <button
      key={action}
      type="button"
      role={inMenu ? "menuitem" : undefined}
      className={inMenu ? "lens-menu-item" : "lens-button"}
      title={READING_ACTIONS[action].hint}
      onClick={() => run(action)}
    >
      {action !== "ask" && <Icon name={ACTION_ICONS[action]} />}
      <span>
        {READING_ACTIONS[action].label}
        {inMenu && <small>{READING_ACTIONS[action].hint}</small>}
      </span>
    </button>
  );
  return (
    <div
      ref={boxRef}
      className="selection-lens"
      role={mode === "actions" ? "toolbar" : "dialog"}
      aria-label={
        mode === "ask"
          ? "Ask about the selection"
          : mode === "note"
            ? "A note on the selection"
            : "Actions for the selection"
      }
      onMouseDown={(event) => {
        if (!(event.target as HTMLElement).closest("input, textarea"))
          event.preventDefault();
      }}
    >
      <div className="lens-surface">
        {mode === "actions" && existing && insight.note && (
          <button className="lens-note-preview" type="button" onClick={toNote}>
            {insight.note}
          </button>
        )}
        {mode === "actions" ? (
          <div className="lens-actions">
            <button
              className="lens-button lens-ask"
              type="button"
              onClick={() => toAsk()}
              title="Or just start typing"
            >
              Ask <span className="lens-caret" />
            </button>
            <span className="lens-divider" />
            {primary.map((action) => actionButton(action))}
            <button
              className="lens-button icon-button"
              type="button"
              aria-label="More actions"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <Icon name="more" />
            </button>
            <span className="lens-divider" />
            {existing ? (
              <>
                <button
                  className="lens-button icon-button"
                  type="button"
                  aria-label={insight.note ? "Edit note" : "Add a note"}
                  title={insight.note ? "Edit note" : "Add a note"}
                  onClick={toNote}
                >
                  <Icon name="pen" />
                </button>
                <button
                  className="lens-button icon-button"
                  type="button"
                  aria-label="Remove highlight"
                  title="Remove highlight"
                  onClick={() => {
                    onSave({ highlighted: false, note: "" });
                    close();
                  }}
                >
                  <Icon name="erase" />
                </button>
              </>
            ) : (
              <>
                <button
                  className="lens-button icon-button"
                  type="button"
                  aria-label="Highlight"
                  title="Highlight"
                  onClick={() => {
                    onSave({ highlighted: true });
                    close();
                  }}
                >
                  <Icon name="highlight" />
                </button>
                <button
                  className="lens-button icon-button"
                  type="button"
                  aria-label="Add a note"
                  title="Add a note"
                  onClick={toNote}
                >
                  <Icon name="pen" />
                </button>
              </>
            )}
          </div>
        ) : mode === "note" ? (
          <form
            className="lens-note-form"
            onSubmit={(event) => {
              event.preventDefault();
              keepNote();
              close();
            }}
          >
            <textarea
              ref={noteRef}
              value={draft}
              rows={1}
              onChange={(event) => setDraft(event.target.value)}
              aria-label="Your note on the selected passage"
              placeholder={
                existing
                  ? "A note on this highlight"
                  : "A note, in your own words"
              }
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  close();
                } else if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  keepNote();
                  close();
                }
              }}
            />
            <div className="lens-note-footer">
              <span>
                ↵ to keep <span>·</span> Shift ↵ new line
              </span>
              <button
                className="lens-send"
                type="submit"
                aria-label="Keep note"
              >
                <Icon name="check" />
              </button>
            </div>
          </form>
        ) : (
          <form
            className="lens-question-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (draft.trim()) run("ask", draft.trim());
            }}
          >
            <div className="lens-question-row">
              <input
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                aria-label="Your question about the selected passage"
                placeholder={
                  short ? "Ask about this word" : "Ask about this passage"
                }
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing) return;
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    close();
                  }
                }}
              />
              <button
                className="lens-send"
                type="submit"
                disabled={!draft.trim()}
                aria-label="Ask"
              >
                <Icon name="up" />
              </button>
            </div>
            {!draft && (
              <div className="lens-starters">
                {STARTERS[short ? "word" : "passage"].map((question) => (
                  <button
                    type="button"
                    key={question}
                    onClick={() => run("ask", question)}
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}
            <span className="lens-demo">
              AI can make mistakes. Check the source.
            </span>
          </form>
        )}
        <span className="lens-pointer" aria-hidden="true" />
      </div>
      {menu && mode === "actions" && (
        <div className="lens-menu" role="menu" aria-label="More actions">
          {more.map((action) => actionButton(action, true))}
          <button
            className="lens-menu-item"
            type="button"
            role="menuitem"
            onClick={async () =>
              setCopyStatus(
                (await copyText(
                  `“${passage.quote}” (${title}, ${passageLabel(passage)})`,
                ))
                  ? "Copied"
                  : "Could not copy. Try again.",
              )
            }
          >
            <Icon name={copyStatus === "Copied" ? "check" : "copy"} />
            <span>
              {copyStatus || "Copy quote"}
              <small>With the title and paragraph number</small>
            </span>
          </button>
        </div>
      )}
      {copyStatus && (
        <span className="sr-only" role="status">
          {copyStatus}
        </span>
      )}
    </div>
  );
};
