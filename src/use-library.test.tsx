import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import type { LibraryState } from "./reading";
import { initialLibrary } from "./reading";
import { useLibrary } from "./use-library";
import { localLibrary } from "./services/local-library";
import { saveCloudLibrary, watchLibrary } from "./services/cloud-library";
const account = vi.hoisted(() => ({
  currentUser: null as User | null,
  notify: undefined as ((user: User | null) => Promise<void>) | undefined,
}));
vi.mock("./services/firebase", () => ({ auth: account }));
vi.mock("firebase/auth", () => ({
  onIdTokenChanged: vi.fn((_auth, notify) => {
    account.notify = notify;
    return vi.fn();
  }),
}));
vi.mock("./services/local-library", () => ({ localLibrary: vi.fn() }));
vi.mock("./services/cloud-library", () => ({
  watchLibrary: vi.fn(() => vi.fn()),
  saveCloudLibrary: vi.fn(async () => {}),
}));
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
  account.currentUser = null;
});
it("preserves guest work when duplicate account token events arrive during migration", async () => {
  const device = new Map<string, LibraryState>();
  let releaseAccount!: (state: LibraryState | undefined) => void;
  const opening = new Promise<LibraryState | undefined>((resolve) => {
    releaseAccount = resolve;
  });
  vi.mocked(localLibrary).mockImplementation(async (owner, state) => {
    if (state) {
      device.set(owner, state);
      return state;
    }
    return owner === "google-account" ? opening : device.get(owner);
  });
  const { result } = renderHook(useLibrary);
  await act(async () => {
    await account.notify!(null);
  });
  const imported = {
    ...initialLibrary().readings[0],
    id: "guest-import",
    title: "Guest's imported reading",
  };
  act(() =>
    result.current.update((state) => ({
      ...state,
      readings: [...state.readings, imported],
    })),
  );
  account.currentUser = { uid: "google-account", isAnonymous: false } as User;
  let first!: Promise<void>;
  let repeated!: Promise<void>;
  act(() => {
    first = account.notify!(account.currentUser);
    repeated = account.notify!(account.currentUser);
  });
  await act(async () => {
    releaseAccount(undefined);
    await Promise.all([first, repeated]);
  });
  expect(
    result.current.state.readings.some((reading) => reading.id === imported.id),
  ).toBe(true);
  const publish = vi.mocked(watchLibrary).mock.calls.at(-1)![1];
  act(() => publish({ readings: [], insights: [] }));
  await waitFor(() => expect(saveCloudLibrary).toHaveBeenCalled());
  expect(vi.mocked(saveCloudLibrary).mock.calls.at(-1)![2].readings).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: imported.id })]),
  );
});

it("merges edits made while device storage is still loading", async () => {
  let release!: (state: LibraryState | undefined) => void;
  const opening = new Promise<LibraryState | undefined>((resolve) => {
    release = resolve;
  });
  vi.mocked(localLibrary).mockImplementation(async (_owner, state) => {
    if (state) return state;
    return opening;
  });
  const { result } = renderHook(useLibrary);
  let loading!: Promise<void>;
  act(() => {
    loading = account.notify!(null);
  });
  const imported = {
    ...initialLibrary().readings[0],
    id: "early-import",
    title: "Added while loading",
  };
  act(() =>
    result.current.update((state) => ({
      ...state,
      readings: [...state.readings, imported],
    })),
  );
  await act(async () => {
    release(undefined);
    await loading;
  });
  expect(result.current.loading).toBe(false);
  expect(
    result.current.state.readings.some(
      (reading) => reading.id === "early-import",
    ),
  ).toBe(true);
});

it("rebases queued cloud saves against the last confirmed state after a failure", async () => {
  const saved = initialLibrary();
  vi.mocked(localLibrary).mockResolvedValue(saved);
  const accountUser = { uid: "google-account", isAnonymous: false } as User;
  account.currentUser = accountUser;
  vi.mocked(saveCloudLibrary).mockImplementation(
    async (_uid, _before, next) => {
      const ids = next.readings.map((reading) => reading.id);
      if (ids.includes("reading-a") && !ids.includes("reading-b"))
        throw new Error("offline");
    },
  );
  const { result } = renderHook(useLibrary);
  await act(async () => {
    await account.notify!(accountUser);
  });
  const receiveCloud = vi.mocked(watchLibrary).mock.calls.at(-1)![1];
  act(() => receiveCloud(initialLibrary()));
  const added = (id: string) => (state: LibraryState) => ({
    ...state,
    readings: [
      ...state.readings,
      { ...initialLibrary().readings[0], id, title: id },
    ],
  });
  act(() => {
    result.current.update(added("reading-a"));
  });
  act(() => {
    result.current.update(added("reading-b"));
  });
  await waitFor(() => expect(saveCloudLibrary).toHaveBeenCalledTimes(3));
  const retry = vi.mocked(saveCloudLibrary).mock.calls.at(-1)!;
  expect(retry[1].readings.some((reading) => reading.id === "reading-a")).toBe(
    false,
  );
  expect(
    ["reading-a", "reading-b"].every((id) =>
      retry[2].readings.some((reading) => reading.id === id),
    ),
  ).toBe(true);
});

it("keeps a signed-in deep link loading until its cloud library arrives", async () => {
  const saved = initialLibrary();
  vi.mocked(localLibrary).mockResolvedValue(saved);
  const accountUser = { uid: "google-account", isAnonymous: false } as User;
  account.currentUser = accountUser;
  const { result } = renderHook(useLibrary);

  expect(result.current.loading).toBe(true);
  await act(async () => {
    await account.notify!(accountUser);
  });
  expect(result.current.loading).toBe(true);

  const receiveCloud = vi.mocked(watchLibrary).mock.calls.at(-1)![1];
  act(() => receiveCloud(saved));
  expect(result.current.loading).toBe(false);
});
