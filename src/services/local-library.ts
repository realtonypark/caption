import { mergeLibraries, type LibraryState } from "../reading";
const open = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("caption-library", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("libraries");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
export const localLibrary = async (
  owner: string,
  state?: LibraryState,
): Promise<LibraryState | undefined> => {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(
        "libraries",
        state ? "readwrite" : "readonly",
      );
      const store = transaction.objectStore("libraries");
      const request = store.get(owner);
      let value: LibraryState | undefined;
      request.onsuccess = () => {
        value = state
          ? mergeLibraries(
              state,
              request.result ?? { readings: [], insights: [] },
            )
          : request.result;
        if (state) store.put(value, owner);
      };
      transaction.oncomplete = () => resolve(value);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
};
