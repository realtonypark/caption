export interface Paragraph {
  text: string;
  explanation: string;
  heading?: string;
  page?: number;
}
export interface Reading {
  id: string;
  title: string;
  author: string;
  description: string;
  kind: "sample" | "link" | "pdf";
  location?: string;
  design: number;
  paragraphs: Paragraph[];
  updatedAt?: number;
}
export interface TextRange {
  paragraph: number;
  start: number;
  end: number;
}
export interface Passage {
  quote: string;
  ranges: TextRange[];
}
export const MARKERS = ["yellow", "green", "blue", "pink"] as const;
export type Marker = (typeof MARKERS)[number];
export type ReadingAction =
  "ask" | "explain" | "define" | "simplify" | "check" | "connect" | "counter";
export const READING_ACTIONS: Record<
  ReadingAction,
  { label: string; hint: string; question: string }
> = {
  ask: {
    label: "Ask",
    hint: "Type any question about it",
    question: "Your question",
  },
  explain: {
    label: "Explain",
    hint: "What it means here, and why it is here",
    question: "What does this mean here?",
  },
  define: {
    label: "Define",
    hint: "The word, as this author uses it",
    question: "What does this word mean here?",
  },
  simplify: {
    label: "Simplify",
    hint: "The same idea in plain words",
    question: "Can you say it more simply?",
  },
  check: {
    label: "Fact-check",
    hint: "Examine the claim and its supporting evidence",
    question: "Does this still hold up?",
  },
  connect: {
    label: "Related",
    hint: "Where else the text takes this up",
    question: "Where else does the text take this up?",
  },
  counter: {
    label: "Counterpoint",
    hint: "The strongest objection to it",
    question: "What is the strongest objection?",
  },
};
export const ARTICLE_QUESTIONS = [
  "What is the core argument, in three sentences?",
  "What evidence does the author lean on most?",
  "What would a sharp skeptic say?",
];
export const isShortSelection = (quote: string) =>
  quote.trim().split(/\s+/).length <= 4;
export interface Exchange {
  question: string;
  answer: string;
  paragraphs: number[];
  threadId?: string;
  action?: ReadingAction;
  scope?: "passage" | "text";
  model?: string;
  status?: "pending" | "error";
  error?: string;
  sources?: { url: string; title?: string }[];
}
export interface Insight {
  id: string;
  readingId: string;
  passage: Passage;
  note: string;
  exchanges: Exchange[];
  highlighted?: boolean;
  color?: Marker;
  updatedAt?: number;
}
export interface InsightPatch {
  note?: string;
  exchange?: Exchange;
  exchanges?: Exchange[];
  highlighted?: boolean;
  color?: Marker;
  removeThread?: string;
  replaceAnswer?: { threadId: string; exchange: Exchange };
}
export interface LibraryState {
  readings: Reading[];
  insights: Insight[];
  deletedReadings?: Record<string, number>;
  deletedInsights?: Record<string, number>;
}

export const BOOK_DESIGN_COUNT = 6;
export const stampLibrary = (
  before: LibraryState,
  next: LibraryState,
  now: number,
): LibraryState => {
  const stamp = <T extends { id: string; updatedAt?: number }>(
    old: T[],
    values: T[],
  ) =>
    values.map((value) =>
      old.find((item) => item.id === value.id) === value
        ? value
        : { ...value, updatedAt: now },
    );
  const removed = (
    old: { id: string }[],
    values: { id: string }[],
    tombstones: Record<string, number> = {},
  ) => ({
    ...tombstones,
    ...Object.fromEntries(
      old
        .filter((item) => !values.some((value) => value.id === item.id))
        .map((item) => [item.id, now]),
    ),
  });
  return {
    ...next,
    readings: stamp(before.readings, next.readings),
    insights: stamp(before.insights, next.insights),
    deletedReadings: removed(
      before.readings,
      next.readings,
      next.deletedReadings,
    ),
    deletedInsights: removed(
      before.insights,
      next.insights,
      next.deletedInsights,
    ),
  };
};
export const mergeLibraries = (
  local: LibraryState,
  remote: LibraryState,
): LibraryState => {
  const tombstones = (
    a: Record<string, number> = {},
    b: Record<string, number> = {},
  ) =>
    Object.fromEntries(
      [...new Set([...Object.keys(a), ...Object.keys(b)])].map((id) => [
        id,
        Math.max(a[id] ?? 0, b[id] ?? 0),
      ]),
    );
  const deletedReadings = tombstones(
    local.deletedReadings,
    remote.deletedReadings,
  );
  const deletedInsights = tombstones(
    local.deletedInsights,
    remote.deletedInsights,
  );
  const merge = <T extends { id: string; updatedAt?: number }>(
    a: T[],
    b: T[],
    deleted: Record<string, number>,
  ) => {
    const values = new Map<string, T>();
    for (const value of [...b, ...a]) {
      const previous = values.get(value.id);
      if (
        (!previous || (value.updatedAt ?? 0) >= (previous.updatedAt ?? 0)) &&
        (deleted[value.id] === undefined ||
          (value.updatedAt ?? 0) > deleted[value.id])
      )
        values.set(value.id, value);
    }
    return [...values.values()];
  };
  const readings = merge(local.readings, remote.readings, deletedReadings);
  return {
    readings,
    insights: merge(local.insights, remote.insights, deletedInsights).filter(
      (insight) => readings.some((reading) => reading.id === insight.readingId),
    ),
    deletedReadings,
    deletedInsights,
  };
};
export const SAMPLE_READINGS: Reading[] = [
  {
    id: "quiet-work",
    title: "The quiet work of remembering",
    author: "Essays",
    description:
      "A short paper on attention, memory, and making room for an idea.",
    kind: "sample",
    design: 0,
    paragraphs: [
      {
        text: "A page can be familiar without its ideas being available to us. We recognize the shape of a paragraph, recall the color of a highlight, and still struggle to explain what the author meant. Recognition is a trace of an encounter. Understanding is something we can use.",
        explanation:
          "Recognizing a sentence is different from being able to explain it. A useful test of understanding is whether you can describe the idea in your own words.",
      },
      {
        text: "This distinction changes the task of reading. The goal is not to leave a mark on every important sentence. It is to build a few reliable paths back to an idea: a question, an example, a connection, or a note in our own words.",
        explanation:
          "A highlight can locate an idea, but a question or personal note explains why it matters. These small connections make a passage easier to return to.",
      },
      {
        heading: "Attention has a shape",
        text: "Consider two ways of moving through a difficult passage. In the first, the reader continues until the language begins to feel familiar. In the second, the reader stops and asks what claim is being made, what supports it, and what would change their mind. The second reader may cover fewer lines, yet leave with a clearer account of the argument.",
        explanation:
          "Reading more lines does not always mean learning more. Pausing to identify a claim and its support can produce a clearer understanding than repeated exposure alone.",
      },
      {
        text: "A pause is not necessarily a failure of momentum. It can be the place where attention changes from receiving words to testing an idea. The pause is useful when it has a small purpose. A question such as “What does this mean here?” gives it a boundary.",
        explanation:
          "A focused question makes a reading pause productive. Instead of stopping indefinitely, you resolve one uncertainty and return to the text.",
      },
      {
        heading: "A note is a return address",
        text: "A useful note does not need to reproduce the passage. It can name the insight and the reason it matters: “Familiarity can disguise a gap in understanding.” Kept beside the original sentence, that note preserves both an interpretation and a way to check it.",
        explanation:
          "Write the takeaway, rather than copying the entire passage. Keeping your interpretation beside its source lets you revisit the idea and check whether the text supports it.",
      },
      {
        text: "When notes become detached from their sources, even good insights can become difficult to trust. We may remember the conclusion but forget the qualification. A connection to the exact passage preserves the difference between what the author said and what we added.",
        explanation:
          "A note needs its source context. Linking it to the original passage helps keep the author’s claim separate from your own interpretation.",
      },
      {
        heading: "Leave something to return to",
        text: "The smallest useful reading ritual is simple: choose one passage, ask one question, and write one takeaway. It does not promise to make every page memorable. It gives the most important idea on this page somewhere to live.",
        explanation:
          "You do not have to capture everything. One clear takeaway attached to one passage is a practical way to retain something useful from a reading session.",
      },
      {
        text: "Reading then becomes a conversation with a future version of ourselves. We leave enough context for that person to pick up the thread, and enough space for them to disagree. An insight worth keeping is not the end of thought. It is a good place to begin again.",
        explanation:
          "Saved insights are starting points for later thinking. Keep enough context to revisit, question, and develop them instead of treating notes as final answers.",
      },
    ],
  },
  {
    id: "city-map",
    title: "A city is more than its map",
    author: "Journal",
    description:
      "A reported-style story about the small systems that hold a city together.",
    kind: "sample",
    design: 1,
    paragraphs: [
      {
        text: "At seven in the morning, a city looks like a collection of destinations. Offices fill, buses arrive, shutters open. But between those visible events runs another city: the routes, routines, and repairs that make an ordinary day possible.",
        explanation:
          "The passage separates visible places from the less visible systems that connect them. A city depends on recurring work, not only on buildings and roads.",
      },
      {
        text: "A map shows a bridge as a line. It cannot show the person who checks a joint before it fails, the crew that clears a drain before a storm, or the dispatcher who finds another route when traffic stops. The map describes where things are. Maintenance helps explain why they still work.",
        explanation:
          "A map records locations, while maintenance keeps those locations usable. The examples show the human work hidden behind apparently permanent infrastructure.",
      },
      {
        heading: "The work we rarely notice",
        text: "When these systems work, they tend to disappear from attention. Water arrives when a tap turns. A streetlight comes on before dark. A bus is close enough to its schedule that nobody has to rearrange their day. Reliability often looks like nothing happening.",
        explanation:
          "Successful maintenance prevents disruptions. Because we mainly notice failures, the work that creates reliability can become easy to overlook.",
      },
      {
        text: "That invisibility creates a problem for how we value the work. A new station has an opening day and a photograph. A well-maintained station has thousands of uneventful mornings. The second achievement is harder to point to, even when more people depend on it.",
        explanation:
          "New projects have visible milestones, but maintenance produces many ordinary days. The author argues that being harder to see does not make that achievement less valuable.",
      },
      {
        heading: "Connections, not just destinations",
        text: "The same idea applies to a neighborhood. A clinic matters, but so does the walk to the clinic. A library matters, but so does a predictable bus home. A useful destination is only as accessible as the connections around it.",
        explanation:
          "Services are useful only if people can reach them. The author shifts attention from isolated facilities to the routes and routines that make access possible.",
      },
      {
        text: "This suggests another way to read a city map. Instead of asking only where a service is, ask what an ordinary person must do to use it. The answer may include waiting, changing buses, crossing a road, or finding a place to rest.",
        explanation:
          "To assess access, follow the whole journey from a person’s perspective. Distance alone does not capture waiting, transfers, safety, or physical effort.",
      },
      {
        heading: "An ordinary day is an achievement",
        text: "The most useful city may not be the one that looks most impressive from above. It may be the one that makes a small trip straightforward, a service dependable, and a difficult day a little easier to navigate.",
        explanation:
          "The conclusion values everyday usefulness over visual grandeur. Reliable, accessible systems can improve daily life without looking spectacular.",
      },
    ],
  },
  {
    id: "unfinished-thoughts",
    title: "In praise of unfinished thoughts",
    author: "Columns",
    description:
      "A column about curiosity, open questions, and resisting the urge to finish everything.",
    kind: "sample",
    design: 2,
    paragraphs: [
      {
        text: "My bookmarks used to look like a set of promises. Each saved page seemed to say: I will read this, understand it, and become the sort of person who knows about this subject. Eventually the promises began to feel more like invoices.",
        explanation:
          "The author describes how saving interesting pages can turn curiosity into a sense of obligation. A growing reading list begins to feel like work owed rather than ideas available.",
      },
      {
        text: "The problem was not a lack of interesting writing. It was the belief that every encounter needed a complete ending. I wanted to finish the article, extract the argument, file the insight, and close the loop before moving on.",
        explanation:
          "The pressure comes from expecting a complete result from every reading. That expectation makes a small, partial insight feel insufficient.",
      },
      {
        heading: "Keep the question",
        text: "An unfinished thought can still be useful. A passage may give us a question we did not know to ask. A paragraph may complicate something we were certain about. Neither encounter needs to produce a polished opinion to be worth keeping.",
        explanation:
          "A reading can be valuable because it opens a question or changes your certainty. You do not need a finished conclusion to save something meaningful.",
      },
      {
        text: "I started writing smaller notes. Not summaries of entire articles, but a sentence about the point that caught me: “What makes a system feel trustworthy?” or “This example changes how I think about waiting.” These notes gave curiosity a place to land.",
        explanation:
          "Short personal notes capture the specific reason a passage mattered. They preserve a question or connection without requiring a full article summary.",
      },
      {
        heading: "A shelf, not a scoreboard",
        text: "A reading library works better as a shelf than a scoreboard. A shelf makes things available. A scoreboard keeps reminding us what has not been completed. The same collection can feel generous or accusing depending on which idea we bring to it.",
        explanation:
          "The shelf metaphor treats saved reading as an available resource. The scoreboard metaphor treats it as unfinished work. The author recommends the first attitude.",
      },
      {
        text: "This does not mean abandoning care. It means allowing a useful encounter to be small. Read a passage closely. Ask for help when a line resists you. Leave a note for yourself. Return when the question becomes relevant again.",
        explanation:
          "Careful reading can happen in small sessions. Focus on one passage, resolve a difficulty, and keep a note rather than forcing yourself to finish everything at once.",
      },
      {
        text: "Some ideas take a long time to become useful. A note that seems incomplete today may find its missing half in another article next month. We do not always need to finish a thought. Sometimes we only need to keep it within reach.",
        explanation:
          "Insights can develop through later connections. Preserving an unfinished idea lets future reading add context and help you understand it more fully.",
      },
    ],
  },
];

export const initialLibrary = (): LibraryState => ({
  readings: SAMPLE_READINGS,
  insights: [],
});
export const normalizeLink = (input: string): string => {
  const value = input.trim();
  if (!value || /\s/.test(value)) throw new Error("Enter a valid web link.");
  const url = new URL(
    // A numeric port belongs to a bare host, while HTTP(S) forms retain their scheme.
    /^(?:https?:|[a-z][a-z\d+.-]*:(?!\d+(?:[/?#]|$)))/i.test(value)
      ? value
      : `https://${value}`,
  );
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new Error("Use a link that starts with https:// or http://.");
  return url.href;
};
export const makePreview = (
  id: string,
  kind: "link" | "pdf",
  label: string,
  design: number,
): Reading => ({
  ...SAMPLE_READINGS[kind === "pdf" ? 0 : 1],
  id,
  kind,
  location: label,
  title:
    kind === "pdf"
      ? label.replace(/\.pdf$/i, "")
      : new URL(label).hostname.replace(/^www\./, ""),
  author: kind === "pdf" ? "Your PDF" : "Your saved link",
  description: "A preview with sample text. Your source has not been imported.",
  design,
});
export const samePassage = (a: Passage, b: Passage): boolean =>
  a.ranges.length === b.ranges.length &&
  a.ranges.every((range, i) => {
    const other = b.ranges[i];
    return (
      range.paragraph === other.paragraph &&
      range.start === other.start &&
      range.end === other.end
    );
  });
export const saveInsight = (
  state: LibraryState,
  readingId: string,
  passage: Passage,
  patch: InsightPatch,
  id: string,
): LibraryState => {
  const previous = state.insights.find(
    (entry) =>
      entry.readingId === readingId && samePassage(entry.passage, passage),
  );
  const lastAnswer = patch.replaceAnswer
    ? previous?.exchanges.findLast(
        (exchange) =>
          (exchange.threadId ?? previous.id) === patch.replaceAnswer?.threadId,
      )
    : undefined;
  const keptExchanges = (patch.exchanges ?? previous?.exchanges ?? [])
    .map((exchange) =>
      exchange === lastAnswer ? patch.replaceAnswer!.exchange : exchange,
    )
    .filter(
      (exchange) =>
        !patch.removeThread ||
        (exchange.threadId ?? previous?.id) !== patch.removeThread,
    );
  const entry: Insight = {
    id: previous?.id ?? id,
    readingId,
    passage,
    note: patch.note ?? previous?.note ?? "",
    exchanges: patch.exchange
      ? [...keptExchanges, patch.exchange]
      : keptExchanges,
    highlighted:
      patch.highlighted ??
      (previous ? (previous.highlighted ?? true) : !patch.exchange),
    color: patch.color ?? previous?.color ?? "yellow",
  };
  return {
    ...state,
    insights: (previous
      ? state.insights.map((item) => (item.id === previous.id ? entry : item))
      : [...state.insights, entry]
    ).filter(
      (item) =>
        item.highlighted !== false || item.note.trim() || item.exchanges.length,
    ),
  };
};
export const wholeParagraph = (reading: Reading, index: number): Passage => ({
  quote: reading.paragraphs[index].text,
  ranges: [
    { paragraph: index, start: 0, end: reading.paragraphs[index].text.length },
  ],
});
export const demoExchange = (
  reading: Reading,
  passage: Passage,
  question: string,
  action: ReadingAction = "ask",
  scope: "passage" | "text" = "passage",
): Exchange => {
  const indexes =
    scope === "text"
      ? reading.paragraphs.map((_, index) => index)
      : [...new Set(passage.ranges.map((range) => range.paragraph))];
  return {
    question,
    answer: indexes
      .map((index) => reading.paragraphs[index].explanation)
      .join(" "),
    paragraphs: indexes.map((index) => index + 1),
    action,
    scope,
  };
};
export const passageSegments = (
  text: string,
  paragraph: number,
  insights: Insight[],
) => {
  const ranges = insights
    .filter(
      (entry) =>
        entry.highlighted !== false ||
        entry.note ||
        entry.exchanges.some((exchange) => exchange.scope !== "text"),
    )
    .flatMap((entry) =>
      entry.passage.ranges
        .filter((range) => range.paragraph === paragraph)
        .map((range) => ({
          ...range,
          id: entry.id,
          highlighted: entry.highlighted !== false,
          color: entry.color ?? "yellow",
          note: !!entry.note,
          question: entry.exchanges.some(
            (exchange) => exchange.scope !== "text",
          ),
        })),
    )
    .sort((a, b) => a.end - a.start - (b.end - b.start));
  const boundaries = [
    ...new Set([
      0,
      text.length,
      ...ranges.flatMap((range) => [range.start, range.end]),
    ]),
  ]
    .filter((position) => position >= 0 && position <= text.length)
    .sort((a, b) => a - b);
  return boundaries.slice(0, -1).map((start, index) => {
    const covering = ranges.filter(
      (range) => range.start <= start && range.end >= boundaries[index + 1],
    );
    return {
      start,
      text: text.slice(start, boundaries[index + 1]),
      insightId: covering[0]?.id,
      highlighted: covering.some((range) => range.highlighted),
      color: covering.find((range) => range.highlighted)?.color,
      hasAnswer: covering.some((range) => range.question),
      noteInsightId: covering.find(
        (range) => range.note && range.end === boundaries[index + 1],
      )?.id,
    };
  });
};

export const passageKey = (passage: Passage) =>
  passage.ranges
    .map((range) => `${range.paragraph}:${range.start}:${range.end}`)
    .join(",");
export const passageLabel = (passage: Passage) => {
  const first = passage.ranges[0].paragraph + 1;
  const last = passage.ranges[passage.ranges.length - 1].paragraph + 1;
  return first === last ? `¶${first}` : `¶${first}–${last}`;
};
export const findInsight = (insights: Insight[], passage: Passage) =>
  insights.find((entry) => samePassage(entry.passage, passage));
export const readingInsights = (state: LibraryState, readingId: string) =>
  state.insights.filter((entry) => entry.readingId === readingId);
export const notepadGroups = (state: LibraryState) =>
  state.readings
    .map((reading) => ({
      reading,
      insights: readingInsights(state, reading.id),
    }))
    .filter((group) => group.insights.length > 0);

export interface AnswerThread {
  id: string;
  insightId: string;
  passage: Passage;
  exchanges: Exchange[];
}
export const answerThreads = (insights: Insight[]): AnswerThread[] => {
  const threads: AnswerThread[] = [];
  for (const insight of insights) {
    for (const exchange of insight.exchanges) {
      const id = exchange.threadId ?? insight.id;
      let thread = threads.find((item) => item.id === id);
      if (!thread) {
        thread = {
          id,
          insightId: insight.id,
          passage: insight.passage,
          exchanges: [],
        };
        threads.push(thread);
      }
      thread.exchanges.push(exchange);
    }
  }
  return threads.sort(
    (a, b) =>
      a.passage.ranges[0].paragraph - b.passage.ranges[0].paragraph ||
      a.passage.ranges[0].start - b.passage.ranges[0].start,
  );
};

export const notepadMarkdown = (state: LibraryState): string =>
  [
    "# Caption Notepad",
    ...notepadGroups(state).flatMap(({ reading, insights }) => [
      `## ${reading.title}`,
      reading.location ? `Source: ${reading.location}` : reading.author,
      ...insights.flatMap((insight) => [
        `### ${passageLabel(insight.passage)}`,
        `> ${insight.passage.quote.replace(/\n/g, "\n> ")}`,
        insight.note ? `Note: ${insight.note}` : "",
        ...insight.exchanges.map(
          (exchange) =>
            `Question: ${exchange.question}\n\n${exchange.answer}${exchange.model ? `\n\nModel: ${exchange.model}` : ""}`,
        ),
      ]),
    ]),
  ]
    .filter(Boolean)
    .join("\n\n");
