import { useSyncExternalStore } from "react";

export const useMedia = (query: string) =>
  useSyncExternalStore(
    (listener) => {
      const media = window.matchMedia?.(query);
      if (media?.addEventListener) {
        media.addEventListener("change", listener);
        return () => media.removeEventListener("change", listener);
      }
      media?.addListener(listener);
      return () => media?.removeListener(listener);
    },
    () => (window.matchMedia ? window.matchMedia(query).matches : true),
    () => true,
  );
