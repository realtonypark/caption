import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useMedia } from "./use-media";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("subscribes, updates, and unsubscribes with the legacy media-query API", () => {
  const listeners = new Set<() => void>();
  const media = {
    matches: false,
    addListener: (listener: () => void) => listeners.add(listener),
    removeListener: (listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal("matchMedia", () => media);
  const view = renderHook(() => useMedia("(min-width: 1080px)"));
  expect(view.result.current).toBe(false);
  act(() => {
    media.matches = true;
    for (const listener of [...listeners]) listener();
  });
  expect(view.result.current).toBe(true);
  view.unmount();
  expect(listeners.size).toBe(0);
});
