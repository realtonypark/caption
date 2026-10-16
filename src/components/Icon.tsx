type IconName =
  | "arrow"
  | "back"
  | "book"
  | "notepad"
  | "link"
  | "file"
  | "spark"
  | "pen"
  | "check"
  | "up"
  | "close"
  | "more"
  | "highlight"
  | "erase"
  | "copy"
  | "collapse"
  | "retry"
  | "trash"
  | "lightbulb"
  | "define"
  | "simplify"
  | "related"
  | "scale"
  | "stop"
  | "globe";
const paths: Record<IconName, string> = {
  arrow: "M4 12h15m-6-6 6 6-6 6",
  back: "M20 12H5m6-6-6 6 6 6",
  book: "M12 5v15m0-15C8 2 4 3 2 4v14c3-1 7-1 10 2 3-3 7-3 10-2V4c-2-1-6-2-10 1Z",
  notepad: "M6 3h13v18H6V3Zm-3 4h5m-5 5h5m-5 5h5m4-10h4m-4 5h4",
  link: "M10 14l4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 1-1 3-3a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0",
  file: "M6 2h8l5 5v15H6V2Zm8 0v6h5M9 12h7m-7 4h7",
  spark: "m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z",
  pen: "m16 3 5 5-12 12-6 1 1-6L16 3Zm-3 3 5 5",
  check: "m4 12 5 5L20 6",
  up: "M12 20V4m-6 6 6-6 6 6",
  close: "m6 6 12 12M6 18 18 6",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  highlight: "m16 3 5 5-9 9-5-5 9-9Zm-9 9-3 6 2 2 6-3M3 22h7",
  erase: "m16 3 5 5-12 12H5l-3-3L16 3Zm-9 9 6 6M9 20h12",
  copy: "M8 8h12v13H8V8ZM4 16H3V3h12v1",
  collapse: "m8 3 4 4 4-4M8 21l4-4 4 4M5 12h14",
  retry: "M3 10a9 9 0 1 1 2 9M3 4v6h6",
  trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7",
  lightbulb: "M9 18h6m-6 3h6M8 14a7 7 0 1 1 8 0l-1 4H9l-1-4Z",
  define: "M3 4h8v16H3V4Zm8 0h10v16H11M14 15l2-7 2 7m-3-2h2",
  simplify: "M20 3c-9-2-14 3-15 13l5 1c8-2 11-7 10-14ZM3 21 15 9",
  related: "M5 5h.01M19 5h.01M12 19h.01M5 5l14 0-7 14-7-14Z",
  scale: "M12 3v18m-5 0h10M4 7h16M4 7l-3 7h6L4 7Zm16 0-3 7h6l-3-7Z",
  stop: "M7 7h10v10H7z",
  globe:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c4 4 4 14 0 18-4-4-4-14 0-18Z",
};
export const Icon = ({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) => (
  <svg
    className={className}
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={paths[name]} />
  </svg>
);
