import { useId } from "react";
import type { Reading } from "../reading";
import { Icon } from "./Icon";
export const Book = ({
  reading,
  onOpen,
}: {
  reading: Reading;
  onOpen: (book: HTMLButtonElement) => void;
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
    </li>
  );
};
