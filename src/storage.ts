import {
  BOOK_DESIGN_COUNT,
  initialLibrary,
  type LibraryState,
  type Passage,
  type Reading,
} from "./reading";

const STORAGE_KEY = "caption:library:v1";
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const validReading = (value: unknown): value is Reading =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.title === "string" &&
  typeof value.author === "string" &&
  typeof value.description === "string" &&
  ["sample", "link", "pdf"].includes(String(value.kind)) &&
  (value.location === undefined || typeof value.location === "string") &&
  typeof value.design === "number" &&
  Number.isInteger(value.design) &&
  value.design >= 0 &&
  value.design < BOOK_DESIGN_COUNT &&
  Array.isArray(value.paragraphs) &&
  value.paragraphs.length > 0 &&
  value.paragraphs.every(
    (paragraph) =>
      isRecord(paragraph) &&
      typeof paragraph.text === "string" &&
      typeof paragraph.explanation === "string" &&
      (paragraph.heading === undefined ||
        typeof paragraph.heading === "string"),
  );
const validPassage = (value: unknown, reading: Reading): value is Passage =>
  isRecord(value) &&
  typeof value.quote === "string" &&
  value.quote.length > 0 &&
  Array.isArray(value.ranges) &&
  value.ranges.length > 0 &&
  value.ranges.every((range) => {
    if (
      !isRecord(range) ||
      !Number.isInteger(range.paragraph) ||
      !Number.isInteger(range.start) ||
      !Number.isInteger(range.end)
    )
      return false;
    const paragraph = reading.paragraphs[range.paragraph as number];
    return (
      paragraph !== undefined &&
      (range.start as number) >= 0 &&
      (range.end as number) > (range.start as number) &&
      (range.end as number) <= paragraph.text.length
    );
  }) &&
  value.ranges
    .map((range) =>
      reading.paragraphs[range.paragraph].text.slice(range.start, range.end),
    )
    .join("\n\n") === value.quote;

export const readLibrary = (): { state: LibraryState; warning?: string } => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return { state: initialLibrary() };
    const value: unknown = JSON.parse(saved);
    if (
      !isRecord(value) ||
      !Array.isArray(value.readings) ||
      !value.readings.every(validReading) ||
      !Array.isArray(value.insights)
    )
      throw new Error("Invalid saved library");
    const readings = value.readings;
    if (new Set(readings.map((reading) => reading.id)).size !== readings.length)
      throw new Error("Duplicate readings");
    for (const entry of value.insights) {
      if (!isRecord(entry)) throw new Error("Invalid saved insight");
      const reading = readings.find((item) => item.id === entry.readingId);
      if (
        !reading ||
        typeof entry.id !== "string" ||
        typeof entry.note !== "string" ||
        !validPassage(entry.passage, reading) ||
        !Array.isArray(entry.exchanges) ||
        !entry.exchanges.every(
          (exchange) =>
            isRecord(exchange) &&
            typeof exchange.question === "string" &&
            typeof exchange.answer === "string" &&
            Array.isArray(exchange.paragraphs) &&
            exchange.paragraphs.every(
              (number) =>
                Number.isInteger(number) &&
                number >= 1 &&
                number <= reading.paragraphs.length,
            ),
        )
      )
        throw new Error("Invalid saved insight");
    }
    if (
      new Set(value.insights.map((entry) => entry.id)).size !==
      value.insights.length
    )
      throw new Error("Duplicate insights");
    return { state: value as unknown as LibraryState };
  } catch (error) {
    console.error("Could not restore the saved library.", error);
    return {
      state: initialLibrary(),
      warning:
        "Your saved library could not be opened. Sample readings are shown; previous saved data has not been replaced.",
    };
  }
};
export const writeLibrary = (state: LibraryState): string | undefined => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return undefined;
  } catch (error) {
    console.error("Could not save the library in this browser.", error);
    return "Browser storage is unavailable. Your changes remain here until this page is closed.";
  }
};
