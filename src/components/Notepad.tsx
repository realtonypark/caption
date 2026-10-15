import {
  notepadMarkdown,
  notepadGroups,
  passageLabel,
  type LibraryState,
} from "../reading";
import { readingPath } from "../routing";
import { ExchangeView } from "./ExchangeView";
import { Icon } from "./Icon";
import { Link } from "./Link";

export const Notepad = ({ state }: { state: LibraryState }) => {
  const groups = notepadGroups(state);
  return (
    <main id="main" className="notepad-page">
      <header className="notepad-header">
        <div className="eyebrow">A place for what stays with you</div>
        <h1>Your Notepad</h1>
        {groups.length > 0 && (
          <button
            type="button"
            className="paper-button export-notepad"
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([notepadMarkdown(state)], {
                  type: "text/markdown;charset=utf-8",
                }),
              );
              const link = document.createElement("a");
              link.href = url;
              link.download = "caption-notepad.md";
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Export notes
          </button>
        )}
        <p>
          Highlights, questions, and little moments of understanding.
          <br /> Kept together, with the pages they came from.
        </p>
      </header>
      {!groups.length ? (
        <section className="notepad-empty">
          <Icon name="notepad" />
          <h2>Leave yourself a thought.</h2>
          <p>
            Highlight a line, ask AI a question, or write a note while you read.
            <br /> Your insights will find a home here.
          </p>
          <Link
            href="/"
            className="paper-button inline-flex items-center gap-3"
          >
            Find something to read
            <Icon name="arrow" />
          </Link>
        </section>
      ) : (
        <div className="notepad-groups">
          {groups.map(({ reading, insights }) => (
            <section
              className="notepad-group"
              key={reading.id}
              aria-labelledby={`group-${reading.id}`}
            >
              <div className="notepad-group-heading flex items-center justify-between">
                <div>
                  <span className="eyebrow">{reading.author}</span>
                  <h2 id={`group-${reading.id}`}>{reading.title}</h2>
                </div>
                <Link
                  href={readingPath(reading.id)}
                  className="return-to-reading flex items-center gap-2"
                >
                  Open reading
                  <Icon name="arrow" />
                </Link>
              </div>
              <div className="insight-list">
                {insights.map((insight) => (
                  <article key={insight.id} className="insight-card">
                    <div className="insight-source flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Icon name="pen" />
                        {passageLabel(insight.passage)}
                      </span>
                      <Link
                        href={readingPath(reading.id, insight.id)}
                        className="return-to-reading flex items-center gap-2"
                      >
                        Back to passage
                        <Icon name="arrow" />
                      </Link>
                    </div>
                    <blockquote>{insight.passage.quote}</blockquote>
                    {insight.note && (
                      <section className="kept-note">
                        <h3>My note</h3>
                        <p>{insight.note}</p>
                      </section>
                    )}
                    {insight.exchanges.length > 0 && (
                      <section className="kept-exchanges">
                        <h3>Questions & understanding</h3>
                        {insight.exchanges.map((exchange, index) => (
                          <ExchangeView exchange={exchange} key={index} />
                        ))}
                      </section>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <footer className="notepad-footer">
        Saved in this browser. Your thoughts stay yours.
      </footer>
    </main>
  );
};
