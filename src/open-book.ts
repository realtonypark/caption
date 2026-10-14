import { flushSync } from "react-dom";

// Presentation only: a temporary copy carries the shelf book into the reader.
let opening = false;
const focusReading = () =>
  document
    .querySelector<HTMLElement>(".article-header h1")
    ?.focus({ preventScroll: true });

export const openBook = async (
  source: HTMLButtonElement,
  reveal: () => void,
) => {
  if (opening) return;
  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !source.animate
  ) {
    flushSync(reveal);
    focusReading();
    return;
  }
  opening = true;
  const app = source.closest<HTMLElement>(".app")!;
  const wasInert = app.inert;
  const bounds = source.getBoundingClientRect();
  const original = source.querySelector<HTMLElement>(".book-volume")!;
  const pose = getComputedStyle(original).transform;
  const layer = document.createElement("div");
  layer.className = "book-opening-layer";
  layer.setAttribute("aria-hidden", "true");
  layer.inert = true;
  const book = source.cloneNode(true) as HTMLButtonElement;
  book.removeAttribute("id");
  book
    .querySelectorAll("[id]")
    .forEach((element) => element.removeAttribute("id"));
  book.classList.add("book-flight");
  const volume = book.querySelector<HTMLElement>(".book-volume")!;
  const cover = book.querySelector<HTMLElement>(".book-top")!;
  const title = source
    .querySelector(".book-title")!
    .cloneNode(true) as HTMLElement;
  title.className = "opening-cover-title";
  cover.append(title);
  const paper = document.createElement("span");
  paper.className = "opening-paper";
  volume.prepend(paper);
  layer.append(book);
  document.body.append(layer);
  document.documentElement.classList.add("book-opening");
  source.classList.add("book-source");
  app.inert = true;

  const animations: Animation[] = [];
  const animate = (
    element: HTMLElement,
    frames: Keyframe[],
    duration: number,
  ) => {
    const animation = element.animate(frames, {
      duration,
      easing: "cubic-bezier(.22,.7,.18,1)",
      fill: "forwards",
    });
    animations.push(animation);
    return animation.finished;
  };
  const listeners = new AbortController();
  let cancelled = false;
  let revealed = false;
  let expectedPopstate = false;
  let transition: ViewTransition | undefined;
  const cancel = () => {
    cancelled = true;
    transition?.skipTransition();
    animations.forEach((animation) => animation.cancel());
  };
  window.addEventListener(
    "popstate",
    () => {
      if (expectedPopstate) expectedPopstate = false;
      else cancel();
    },
    { signal: listeners.signal },
  );
  window.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") cancel();
    },
    { signal: listeners.signal },
  );
  const showReading = () => {
    if (revealed || cancelled) return;
    revealed = true;
    // Consume only the synchronous popstate dispatched by this navigation.
    expectedPopstate = true;
    try {
      flushSync(reveal);
    } finally {
      expectedPopstate = false;
    }
  };
  try {
    const width = Math.min(360, window.innerWidth * 0.66);
    const height = Math.min(width * 1.4, window.innerHeight * 0.58);
    const position = {
      left: `${(window.innerWidth - width) / 2}px`,
      top: `${(window.innerHeight + height - original.offsetHeight) / 2}px`,
      width: `${width}px`,
    };
    await Promise.all([
      animate(
        layer,
        [{ backgroundColor: "#20181900" }, { backgroundColor: "#201819" }],
        320,
      ),
      animate(
        book,
        [
          {
            left: `${bounds.left}px`,
            top: `${bounds.top}px`,
            width: `${bounds.width}px`,
          },
          position,
        ],
        520,
      ),
      animate(
        volume,
        [{ transform: pose }, { transform: "rotateX(-90deg) rotateY(0deg)" }],
        520,
      ),
      animate(cover, [{ height: "150px" }, { height: `${height}px` }], 520),
      animate(paper, [{ height: "150px" }, { height: `${height}px` }], 520),
      animate(
        title,
        [
          { opacity: 0, offset: 0 },
          { opacity: 0, offset: 0.3 },
          { opacity: 1 },
        ],
        520,
      ),
    ]);
    await animate(
      cover,
      [
        { transform: "rotateX(90deg) rotateY(0deg)" },
        { transform: "rotateX(90deg) rotateY(-155deg)" },
      ],
      420,
    );
    if (cancelled) return;
    if (document.startViewTransition) {
      transition = document.startViewTransition(() => {
        layer.remove();
        showReading();
      });
      await transition.finished;
    } else {
      // Older browsers still get the opening and an expanding paper surface.
      await Promise.all([
        animate(
          book,
          [
            position,
            {
              left: "0px",
              top: `${window.innerHeight - original.offsetHeight / 2}px`,
              width: `${window.innerWidth}px`,
            },
          ],
          460,
        ),
        animate(
          paper,
          [{ height: `${height}px` }, { height: `${window.innerHeight}px` }],
          460,
        ),
      ]);
      showReading();
      await animate(layer, [{ opacity: 1 }, { opacity: 0 }], 160);
    }
  } catch (error) {
    if (!cancelled) {
      console.error(
        "Book animation interrupted; opening the reading directly.",
        error,
      );
      showReading();
    }
  } finally {
    listeners.abort();
    animations.forEach((animation) => animation.cancel());
    layer.remove();
    source.classList.remove("book-source");
    document.documentElement.classList.remove("book-opening");
    app.inert = wasInert;
    opening = false;
    const shelfBook = source.isConnected
      ? source
      : document.getElementById(source.id);
    if (shelfBook) shelfBook.focus({ preventScroll: true });
    else if (revealed) focusReading();
  }
};
