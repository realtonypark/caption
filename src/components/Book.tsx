import { useId } from "react";
import type { Reading } from "../reading";
import { Icon } from "./Icon";
export const Book = ({
  reading,
  shelves = [],
  onOpen,
  onRename,
  onRemove,
  onShelf,
}: {
  reading: Reading;
  shelves?: string[];
  onOpen: (book: HTMLButtonElement) => void;
  onRename?: () => void;
  onRemove?: () => void;
  onShelf?: (shelf: string | undefined) => void;
}) => {
  const contextId = useId();
  return (
    <li className="book-row">
      <button
        id={`reading-book-${encodeURIComponent(reading.id)}`}
        type="button"
        className="book-button"
        data-design={reading.design}
        onClick={(event) => onOpen(event.currentTarget)}
        aria-label={`Read ${reading.title}`}
        aria-describedby={contextId}
      >
        <span className="book-volume">
          <span className="book-top" aria-hidden="true">
            <span className="cover-lines" />
          </span>
          <span className="book-bottom" aria-hidden="true" />
          <span className="book-pages" aria-hidden="true" />
          <span className="book-spine">
            <span className="book-author">{reading.author}</span>
            <span className="book-title">{reading.title}</span>
            <span className="book-emblem">
              <Icon name="book" />
            </span>
          </span>
        </span>
        <span className="sr-only" id={contextId}>
          {reading.author}. {reading.description}
        </span>
      </button>
      {(onRename || onRemove || onShelf) && (
        <div className="book-actions">
          {onShelf && (
            <select
              className="book-shelf"
              aria-label={`Shelf for ${reading.title}`}
              value={reading.shelf ?? ""}
              onChange={(event) => {
                const input = event.currentTarget;
                if (input.value !== "__new") {
                  onShelf(input.value || undefined);
                  return;
                }
                const shelf = window.prompt("Name this shelf");
                if (shelf === null) {
                  input.value = reading.shelf ?? "";
                  return;
                }
                if (!shelf.trim()) {
                  window.alert("A shelf needs a name.");
                  input.value = reading.shelf ?? "";
                  return;
                }
                onShelf(shelf.trim().slice(0, 80));
              }}
            >
              <option value="">General</option>
              {shelves
                .filter((shelf) => shelf !== reading.shelf)
                .map((shelf) => (
                  <option key={shelf} value={shelf}>
                    {shelf}
                  </option>
                ))}
              {reading.shelf && (
                <option value={reading.shelf}>{reading.shelf}</option>
              )}
              <option value="__new">New shelf…</option>
            </select>
          )}
          {onRename && (
            <button
              type="button"
              aria-label={`Rename ${reading.title}`}
              onClick={onRename}
            >
              <Icon name="pen" />
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              aria-label={`Remove ${reading.title}`}
              onClick={onRemove}
            >
              <Icon name="trash" />
            </button>
          )}
        </div>
      )}
    </li>
  );
};
