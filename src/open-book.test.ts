import { afterEach, expect, it, vi } from "vitest";
import { openBook } from "./open-book";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as { animate?: unknown }).animate;
  delete (document as { startViewTransition?: unknown }).startViewTransition;
  document.body.replaceChildren();
});

const shelfBook = () => {
  document.body.innerHTML = `<div class="app"><button class="book-button" data-design="2"><span class="book-volume"><span class="book-top"></span><span class="book-title">A reading</span></span></button></div>`;
  document.querySelector<HTMLElement>(".app")!.inert = false;
  return document.querySelector<HTMLButtonElement>("button")!;
};
const motionPreference = (reduce: boolean) => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: reduce })),
  );
};
const showReader = () => {
  document.querySelector(".app")!.innerHTML =
    `<header class="article-header"><h1 tabindex="-1">A reading</h1></header>`;
};

it("skips motion and focuses the reader when reduced motion is requested", async () => {
  motionPreference(true);
  const reveal = vi.fn(showReader);
  await openBook(shelfBook(), reveal);
  expect(reveal).toHaveBeenCalledOnce();
  expect(document.activeElement?.tagName).toBe("H1");
  expect(document.querySelector(".book-opening-layer")).toBeNull();
});

it("hands off once after opening, ignores repeated clicks, and removes temporary state", async () => {
  motionPreference(false);
  const source = shelfBook();
  const reveal = vi.fn(showReader);
  const animate = vi.fn(() => ({
    finished: Promise.resolve(),
    cancel: vi.fn(),
  }));
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: animate,
  });
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    value: (update: () => void) =>
      ({
        finished: Promise.resolve().then(update),
      }) as ViewTransition,
  });
  const complete = openBook(source, reveal);
  await openBook(source, reveal);
  expect(reveal).not.toHaveBeenCalled();
  expect(
    document.querySelector(".book-flight")?.getAttribute("data-design"),
  ).toBe("2");
  await complete;
  expect(reveal).toHaveBeenCalledOnce();
  expect(document.querySelector<HTMLElement>(".app")?.inert).toBe(false);
  expect(document.documentElement.classList.contains("book-opening")).toBe(
    false,
  );
  expect(document.querySelector(".book-opening-layer")).toBeNull();
});

it("cancels pending navigation on browser history changes and restores the shelf", async () => {
  motionPreference(false);
  const source = shelfBook();
  const reveal = vi.fn();
  const animate = vi.fn(() => {
    let reject!: (reason: Error) => void;
    const finished = new Promise<void>((_, fail) => {
      reject = fail;
    });
    const cancel = () => reject(new DOMException("Aborted", "AbortError"));
    return { finished, cancel };
  });
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: animate,
  });
  const complete = openBook(source, reveal);
  window.dispatchEvent(new PopStateEvent("popstate"));
  await complete;
  expect(reveal).not.toHaveBeenCalled();
  expect(source.classList.contains("book-source")).toBe(false);
  expect(document.querySelector(".book-opening-layer")).toBeNull();
  expect(document.activeElement).toBe(source);
});

it("opens the reader when View Transitions are unavailable", async () => {
  motionPreference(false);
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: () => ({ finished: Promise.resolve(), cancel: vi.fn() }),
  });
  const reveal = vi.fn(showReader);
  await openBook(shelfBook(), reveal);
  expect(reveal).toHaveBeenCalledOnce();
  expect(document.activeElement?.tagName).toBe("H1");
  expect(document.querySelector<HTMLElement>(".app")?.inert).toBe(false);
});
