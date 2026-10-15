import { useEffect, useRef, useState } from "react";
import {
  demoExchange,
  findInsight,
  passageKey,
  passageSegments,
  wholeParagraph,
  type Exchange,
  type Insight,
  type Passage,
  type Reading,
} from "../reading";
import { capturePassage } from "../selection";
import { Icon } from "./Icon";
import { Margin } from "./Margin";

interface ReaderProps {
  reading: Reading;
  insights: Insight[];
  initialInsight?: Insight;
  onSave: (
    passage: Passage,
    patch: { note?: string; exchange?: Exchange },
  ) => void;
}

export const Reader = ({
  reading,
  insights,
  initialInsight,
  onSave,
}: ReaderProps) => {
  const [passage, setPassage] = useState<Passage | undefined>(
    initialInsight?.passage,
  );
  const article = useRef<HTMLElement>(null);
  const activeInsight = passage ? findInsight(insights, passage) : undefined;
  const initialParagraph = initialInsight?.passage.ranges[0].paragraph;
  const selectText = () => {
    if (!article.current) return;
    const captured = capturePassage(article.current);
    if (captured) setPassage(captured);
  };
  const goToParagraph = (index: number) =>
    document
      .getElementById(`paragraph-${index}`)
      ?.scrollIntoView({ block: "center", behavior: "instant" });
  useEffect(() => {
    if (initialParagraph !== undefined)
      document
        .getElementById(`paragraph-${initialParagraph}`)
        ?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [initialParagraph]);
  return (
    <main id="main" className="reader-page">
      <div className="reading-layout">
        <article
          ref={article}
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
                    type="button"
                    className="paragraph-number"
                    aria-label={`Select paragraph ${index + 1}`}
                    aria-pressed={
                      passage?.ranges.some(
                        (range) => range.paragraph === index,
                      ) ?? false
                    }
                    onClick={() => {
                      window.getSelection()?.removeAllRanges();
                      setPassage(wholeParagraph(reading, index));
                    }}
                  >
                    ¶{index + 1}
                  </button>
                  <p data-paragraph={index}>
                    {passageSegments(paragraph.text, index, insights).map(
                      (segment) =>
                        segment.insightId ? (
                          <button
                            key={segment.start}
                            className="saved-highlight"
                            type="button"
                            aria-label={`Open saved insight: ${segment.text}`}
                            onClick={() =>
                              setPassage(
                                insights.find(
                                  (entry) => entry.id === segment.insightId,
                                )?.passage,
                              )
                            }
                          >
                            {segment.text}
                          </button>
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
            {passage && (
              <a className="mobile-margin-link" href="#margin">
                Your selected passage and notes ↓
              </a>
            )}
          </footer>
        </article>
        <Margin
          key={passage ? passageKey(passage) : "empty"}
          passage={passage}
          insight={activeInsight}
          onSave={(patch) => {
            if (passage) onSave(passage, patch);
          }}
          onAsk={(question) => {
            if (passage)
              onSave(passage, {
                exchange: demoExchange(reading, passage, question),
              });
          }}
          onParagraph={goToParagraph}
        />
      </div>
    </main>
  );
};
