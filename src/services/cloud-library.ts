import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  writeBatch,
  Timestamp,
  type QuerySnapshot,
} from "firebase/firestore";
import { database } from "./firebase";
import { type LibraryState, type Reading, type Insight } from "../reading";

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
          value.paragraphs = chunks.docs
            .filter(
              (chunk) => Number(chunk.id) < (value.chunkCount ?? chunks.size),
            )
            .sort((a, b) => Number(a.id) - Number(b.id))
            .flatMap((d) => d.data().paragraphs);
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
  let batch = writeBatch(database);
  let count = 0;
  const set = async (path: string, value: Record<string, unknown>) => {
    batch.set(doc(database, path), value);
    count++;
    if (count >= 400) {
      await batch.commit();
      batch = writeBatch(database);
      count = 0;
    }
  };
  for (const kind of ["readings", "insights"] as const) {
    for (const value of next[kind]) {
      const old = before[kind].find((v) => v.id === value.id);
      if (old && (old.updatedAt ?? 0) === (value.updatedAt ?? 0)) continue;
      const path = `users/${uid}/${kind}/${value.id}`;
      const updatedAt = Timestamp.fromMillis(value.updatedAt ?? 0);
      if (
        kind === "readings" &&
        new TextEncoder().encode(JSON.stringify(value)).length > 700000
      ) {
        const reading = value as Reading;
        let paragraphs: Reading["paragraphs"] = [];
        let bytes = 0;
        let index = 0;
        for (const paragraph of reading.paragraphs) {
          const size = new TextEncoder().encode(
            JSON.stringify(paragraph),
          ).length;
          if (bytes + size > 500000 && paragraphs.length) {
            await set(`${path}/chunks/${index++}`, { paragraphs });
            paragraphs = [];
            bytes = 0;
          }
          paragraphs.push(paragraph);
          bytes += size;
        }
        if (paragraphs.length)
          await set(`${path}/chunks/${index}`, { paragraphs });
        await set(path, {
          value: {
            ...reading,
            paragraphs: [],
            chunked: true,
            chunkCount: index + 1,
          },
          updatedAt,
          deleted: false,
        });
      } else await set(path, { value, updatedAt, deleted: false });
    }
    const key = kind === "readings" ? "deletedReadings" : "deletedInsights";
    for (const [id, time] of Object.entries(next[key] ?? {})) {
      if (
        before[key]?.[id] === time ||
        next[kind].some((v) => v.id === id && (v.updatedAt ?? 0) > time)
      )
        continue;
      await set(`users/${uid}/${kind}/${id}`, {
        value: {},
        updatedAt: Timestamp.fromMillis(time),
        deleted: true,
      });
    }
  }
  if (count) await batch.commit();
};
