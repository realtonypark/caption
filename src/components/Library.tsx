import type { Reading } from "../reading";
import { Book } from "./Book";
import { SourceInput } from "./SourceInput";
export const Library = ({
  readings,
  onAdd,
  onOpen,
}: {
  readings: Reading[];
  onAdd: (kind: "link" | "pdf", label: string) => void;
  onOpen: (id: string) => void;
}) => (
  <main id="main" className="library-page">
    <SourceInput onAdd={onAdd} />
    <section className="shelf" aria-labelledby="library-title">
      <div className="shelf-heading flex items-baseline justify-between">
        <h2 id="library-title">Your library</h2>
        <span>{readings.length} readings</span>
      </div>
      {readings.length ? (
        <ul className="book-stack">
          {readings.map((reading) => (
            <Book
              key={reading.id}
              reading={reading}
              onOpen={() => onOpen(reading.id)}
            />
          ))}
        </ul>
      ) : (
        <p className="empty-library">
          A link or a PDF is all it takes to start your shelf.
        </p>
      )}
    </section>
  </main>
);
