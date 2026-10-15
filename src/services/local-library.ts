import type { LibraryState } from "../reading";
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
      const request = state
        ? transaction.objectStore("libraries").put(state, owner)
        : transaction.objectStore("libraries").get(owner);
      transaction.oncomplete = () => resolve(state ?? request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
};
