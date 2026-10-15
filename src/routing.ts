import { useSyncExternalStore } from "react";
const subscribe = (listener: () => void) => {
  window.addEventListener("popstate", listener);
  return () => window.removeEventListener("popstate", listener);
};
export const useRoute = () =>
  useSyncExternalStore(
    subscribe,
    () => window.location.pathname + window.location.search,
    () => "/",
  );
export const readingPath = (id: string, insightId?: string): string =>
  `/read/${encodeURIComponent(id)}${insightId ? `?insight=${encodeURIComponent(insightId)}` : ""}`;
export const navigate = (path: string) => {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "instant" });
};
