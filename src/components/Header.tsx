import { Icon } from "./Icon";
import { Link } from "./Link";
import type { ReactNode } from "react";
export const Header = ({
  current,
  account,
}: {
  current: "library" | "reading" | "notepad" | "models";
  account?: ReactNode;
}) => (
  <header className="site-header flex items-center justify-between">
    <a className="skip-link" href="#main">
      Skip to content
    </a>
    <Link
      href="/"
      className="wordmark flex items-center gap-3"
      aria-label="Caption, your library"
    >
      <svg
        width="29"
        height="34"
        viewBox="0 0 30 36"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M24 7C20 2 8 3 5 10c-4 10 0 21 9 22 4 1 8-1 11-4M22 11c-5-5-12-2-13 5-1 8 3 13 9 12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M22 4v13l3-3 3 3V5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      <span>Caption</span>
    </Link>
    <nav aria-label="Main navigation" className="flex items-center gap-7">
      <Link
        href="/"
        aria-current={current === "library" ? "page" : undefined}
        className="nav-link flex items-center gap-2"
      >
        <Icon name={current === "reading" ? "back" : "book"} />
        <span>Library</span>
      </Link>
      <Link
        href="/notepad"
        aria-current={current === "notepad" ? "page" : undefined}
        className="nav-link flex items-center gap-2"
      >
        <Icon name="notepad" />
        <span>Notepad</span>
      </Link>
      {account}
      <a
        href="https://github.com/realtonypark/caption"
        target="_blank"
        rel="noreferrer"
        className="nav-link flex items-center gap-2"
      >
        <Icon name="github" filled />
        <span>Open Source</span>
      </a>
    </nav>
  </header>
);
