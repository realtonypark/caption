import { useSyncExternalStore } from "react";

export const useMedia = (query: string) =>
  useSyncExternalStore(
    (listener) => {
      const media = window.matchMedia?.(query);
      media?.addEventListener("change", listener);
      return () => media?.removeEventListener("change", listener);
    },
    () => (window.matchMedia ? window.matchMedia(query).matches : true),
    () => true,
  );
