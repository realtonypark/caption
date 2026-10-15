type IconName =
  | "arrow"
  | "back"
  | "book"
  | "notepad"
  | "link"
  | "file"
  | "spark"
  | "pen"
  | "check";
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
