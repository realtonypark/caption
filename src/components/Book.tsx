import { useId } from "react";
import type { Reading } from "../reading";
import { Icon } from "./Icon";
export const Book = ({
  reading,
  onOpen,
  onRename,
  onRemove,
}: {
  reading: Reading;
  onOpen: (book: HTMLButtonElement) => void;
  onRename?: () => void;
  onRemove?: () => void;
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
            <span className="book-author">
              {reading.kind === "sample" ? "Sample" : reading.author}
            </span>
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
      {(onRename || onRemove) && (
        <div className="book-actions">
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
