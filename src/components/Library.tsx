import type { Reading } from "../reading";
import { Book } from "./Book";
import { SourceInput, type SourceAdd } from "./SourceInput";
export const Library = ({
  readings,
  onAdd,
  onOpen,
  onRename,
  progress,
  onRemove,
}: {
  readings: Reading[];
  onAdd: (input: SourceAdd) => void | Promise<void>;
  onOpen: (id: string, book: HTMLButtonElement) => void;
  onRename: (id: string) => void;
  progress?: { message: string; fraction?: number };
  onRemove?: (id: string) => void;
}) => (
  <main id="main" className="library-page">
    <SourceInput onAdd={onAdd} />
    {progress?.message && (
      <p className="import-progress" role="status">
        {progress.message}
      </p>
    )}
    {progress?.fraction !== undefined && (
      <progress
        className="import-bar"
        value={progress.fraction}
        max={1}
        aria-label="Import progress"
      />
    )}
    <section className="shelf" aria-labelledby="library-title">
      <div className="shelf-heading flex items-baseline justify-between">
        <h2 id="library-title">Your library</h2>
        <span>
          {readings.length} {readings.length === 1 ? "reading" : "readings"}
        </span>
      </div>
      {readings.length ? (
        <ul className="book-stack">
          {readings.map((reading) => (
            <Book
              key={reading.id}
              reading={reading}
              onOpen={(book) => onOpen(reading.id, book)}
              onRename={() => onRename(reading.id)}
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
