import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  runTransaction,
  Timestamp,
  type QuerySnapshot,
} from "firebase/firestore";
import { database } from "./firebase";
import {
  type LibraryState,
  type Reading,
  type Insight,
  CHUNK_BUDGET,
} from "../reading";

type StoredParagraph = Reading["paragraphs"][number] & {
  continuation?: boolean;
};

const splitParagraph = (
  paragraph: Reading["paragraphs"][number],
): StoredParagraph[] => {
  const encoder = new TextEncoder();
  if (encoder.encode(JSON.stringify(paragraph)).length <= CHUNK_BUDGET)
    return [paragraph];
  const { text, ...rest } = paragraph;
  if (!text) return [paragraph];
  const budget =
    CHUNK_BUDGET -
    encoder.encode(JSON.stringify({ ...rest, text: "" })).length -
    64;
  const pieces: StoredParagraph[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + budget);
    while (
      end > start + 1 &&
      encoder.encode(text.slice(start, end)).length > budget
    )
      end = start + Math.floor((end - start) / 2);
    const slice = text.slice(start, end);
    pieces.push(
      pieces.length
        ? { text: slice, explanation: "", continuation: true }
        : { ...rest, text: slice },
    );
    start = end;
  }
  return pieces;
};

const sameEntry = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => sameEntry(item, b[index]))
    );
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) =>
      sameEntry(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      ),
    )
  );
};

const storedTime = (data: Record<string, unknown> | undefined): number => {
  const updatedAt = data?.updatedAt;
  return updatedAt instanceof Timestamp ? updatedAt.toMillis() : -1;
};

export const watchLibrary = (
  uid: string,
  onValue: (state: LibraryState) => void,
  onError: (error: Error) => void,
) => {
  let readings: QuerySnapshot | undefined;
  let insights: QuerySnapshot | undefined;
  let stopped = false;
  let generation = 0;
  const publish = async () => {
    if (
      stopped ||
      !readings ||
      !insights ||
      readings.metadata.fromCache ||
      insights.metadata.fromCache
    )
      return;
    const run = ++generation;
    try {
      const state: LibraryState = {
        readings: [],
        insights: [],
        deletedReadings: {},
        deletedInsights: {},
      };
      for (const item of readings.docs) {
        const data = item.data();
        if (data.deleted) {
          state.deletedReadings![item.id] = data.updatedAt.toMillis();
          continue;
        }
        const value = { ...data.value } as Reading & {
          chunked?: boolean;
          chunkCount?: number;
        };
        if (value.chunked) {
          const chunks = await getDocs(
            collection(database, `users/${uid}/readings/${item.id}/chunks`),
          );
          const stored = chunks.docs
            .filter(
              (chunk) => Number(chunk.id) < (value.chunkCount ?? chunks.size),
            )
            .sort((a, b) => Number(a.id) - Number(b.id))
            .flatMap((d) => d.data().paragraphs as StoredParagraph[]);
          value.paragraphs = [];
          for (const paragraph of stored) {
            const last = value.paragraphs.at(-1);
            if (paragraph.continuation && last) last.text += paragraph.text;
            else value.paragraphs.push(paragraph);
          }
        }
        state.readings.push(value);
      }
      for (const item of insights.docs) {
        const data = item.data();
        if (data.deleted)
          state.deletedInsights![item.id] = data.updatedAt.toMillis();
        else state.insights.push(data.value as Insight);
      }
      if (run === generation) onValue(state);
    } catch (error) {
      onError(
        error instanceof Error
          ? error
          : new Error("Could not load your cloud library."),
      );
    }
  };
  const stopReading = onSnapshot(
    collection(database, `users/${uid}/readings`),
    { includeMetadataChanges: true },
    (snapshot) => {
      readings = snapshot;
      void publish();
    },
    onError,
  );
  const stopInsight = onSnapshot(
    collection(database, `users/${uid}/insights`),
    { includeMetadataChanges: true },
    (snapshot) => {
      insights = snapshot;
      void publish();
    },
    onError,
  );
  return () => {
    stopped = true;
    generation++;
    stopReading();
    stopInsight();
  };
};
export const saveCloudLibrary = async (
  uid: string,
  before: LibraryState,
  next: LibraryState,
) => {
  for (const kind of ["readings", "insights"] as const) {
    for (const value of next[kind]) {
      const old = before[kind].find((v) => v.id === value.id);
      if (
        old &&
        (old.updatedAt ?? 0) === (value.updatedAt ?? 0) &&
        sameEntry(old, value)
      )
        continue;
      const path = `users/${uid}/${kind}/${value.id}`;
      const time = value.updatedAt ?? 0;
      const reading = value as Reading;
      const chunked =
        kind === "readings" &&
        new TextEncoder().encode(JSON.stringify(value)).length > 700000;
      const chunks: StoredParagraph[][] = [];
      if (chunked) {
        let paragraphs: StoredParagraph[] = [];
        let bytes = 0;
        for (const paragraph of reading.paragraphs.flatMap(splitParagraph)) {
          const size = new TextEncoder().encode(
            JSON.stringify(paragraph),
          ).length;
          if (bytes + size > CHUNK_BUDGET && paragraphs.length) {
            chunks.push(paragraphs);
            paragraphs = [];
            bytes = 0;
          }
          paragraphs.push(paragraph);
          bytes += size;
        }
        if (paragraphs.length) chunks.push(paragraphs);
      }
      const listing = chunked
        ? await getDocs(collection(database, `${path}/chunks`))
        : undefined;
      await runTransaction(database, async (tx) => {
        const ref = doc(database, path);
        const stored = await tx.get(ref);
        if (storedTime(stored.data()) >= time) return;
        if (chunked) {
          for (const chunk of listing?.docs ?? [])
            if (Number(chunk.id) >= chunks.length) tx.delete(chunk.ref);
          chunks.forEach((paragraphs, index) =>
            tx.set(doc(database, `${path}/chunks/${index}`), { paragraphs }),
          );
          tx.set(ref, {
            value: {
              ...reading,
              paragraphs: [],
              chunked: true,
              chunkCount: chunks.length,
            },
            updatedAt: Timestamp.fromMillis(time),
            deleted: false,
          });
        } else
          tx.set(ref, {
            value,
            updatedAt: Timestamp.fromMillis(time),
            deleted: false,
          });
      });
    }
    const key = kind === "readings" ? "deletedReadings" : "deletedInsights";
    for (const [id, time] of Object.entries(next[key] ?? {})) {
      if (
        before[key]?.[id] === time ||
        next[kind].some((v) => v.id === id && (v.updatedAt ?? 0) > time)
      )
        continue;
      const path = `users/${uid}/${kind}/${id}`;
      const listing =
        kind === "readings"
          ? await getDocs(collection(database, `${path}/chunks`))
          : undefined;
      await runTransaction(database, async (tx) => {
        const ref = doc(database, path);
        const stored = await tx.get(ref);
        if (storedTime(stored.data()) >= time) return;
        for (const chunk of listing?.docs ?? []) tx.delete(chunk.ref);
        tx.set(ref, {
          value: {},
          updatedAt: Timestamp.fromMillis(time),
          deleted: true,
        });
      });
    }
  }
};
