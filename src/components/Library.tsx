import { EXAMPLE_READING_ID, type Reading } from "../reading";
import { Book } from "./Book";
import { SourceInput } from "./SourceInput";
const isTutorial = (reading: Reading) =>
  reading.kind === "sample" || reading.id === EXAMPLE_READING_ID;
export const Library = ({
  readings,
  onAdd,
  onOpen,
  onRename,
  progress,
  onRemove,
}: {
  readings: Reading[];
  onAdd: (
    kind: "link" | "pdf",
    label: string,
    file?: File,
  ) => void | Promise<void>;
  onOpen: (id: string, book: HTMLButtonElement) => void;
  onRename: (id: string) => void;
  progress?: string;
  onRemove?: (id: string) => void;
}) => {
  const tutorials = readings.filter(isTutorial);
  const mine = readings.filter((reading) => !isTutorial(reading));
  return (
    <main id="main" className="library-page">
      <SourceInput onAdd={onAdd} />
      {progress && (
        <p className="import-progress" role="status">
          {progress}
        </p>
      )}
      {tutorials.length > 0 && (
        <section className="shelf" aria-labelledby="tutorials-title">
          <div className="shelf-heading flex items-baseline justify-between">
            <h2 id="tutorials-title">Tutorials</h2>
            <span>
              {tutorials.length}{" "}
              {tutorials.length === 1 ? "reading" : "readings"} · always on your
              shelf
            </span>
          </div>
          <ul className="book-stack">
            {tutorials.map((reading) => (
              <Book
                key={reading.id}
                reading={reading}
                onOpen={(book) => onOpen(reading.id, book)}
              />
            ))}
          </ul>
        </section>
      )}
      <section className="shelf" aria-labelledby="library-title">
        <div className="shelf-heading flex items-baseline justify-between">
          <h2 id="library-title">Your library</h2>
          <span>
            {mine.length} {mine.length === 1 ? "reading" : "readings"}
          </span>
        </div>
        {mine.length ? (
          <ul className="book-stack">
            {mine.map((reading) => (
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
};
