import type { Reading } from "../reading";
import { Book } from "./Book";
import { SourceInput, type AddSource } from "./SourceInput";
export const Library = ({
  readings,
  onAdd,
  onOpen,
  progress,
  onRemove,
}: {
  readings: Reading[];
  onAdd: AddSource;
  onOpen: (id: string, book: HTMLButtonElement) => void;
  progress?: string;
  onRemove?: (id: string) => void;
}) => (
  <main id="main" className="library-page">
    <SourceInput onAdd={onAdd} />
    {progress && (
      <p className="import-progress" role="status">
        {progress}
      </p>
    )}
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
              onOpen={(book) => onOpen(reading.id, book)}
              onRemove={onRemove ? () => onRemove(reading.id) : undefined}
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
