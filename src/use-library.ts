import { useEffect, useRef, useState } from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { auth } from "./services/firebase";
import { localLibrary } from "./services/local-library";
import { watchLibrary, saveCloudLibrary } from "./services/cloud-library";
import {
  initialLibrary,
  mergeLibraries,
  stampLibrary,
  type LibraryState,
} from "./reading";
import { readLibrary } from "./storage";

export const useLibrary = () => {
  const [restored] = useState(readLibrary);
  const [state, setState] = useState(restored.state);
  const [user, setUser] = useState<User | null>(null);
  const [warning, setWarning] = useState(restored.warning);
  const [status, setStatus] = useState("Saved on this device");
  const current = useRef(state);
  const owner = useRef("guest");
  const ready = useRef(false);
  const cloud = useRef<LibraryState>({ readings: [], insights: [] });
  const queue = useRef(Promise.resolve());
  const persist = (next: LibraryState) => {
    const id = owner.current;
    const account = auth.currentUser;
    void localLibrary(id, next).catch(() =>
      setWarning(
        "Device storage is unavailable. Keep this page open until your work is synced.",
      ),
    );
    if (account && !account.isAnonymous && ready.current) {
      setStatus("Saving…");
      const previous = cloud.current;
      cloud.current = next;
      queue.current = queue.current
        .catch(() => {})
        .then(() =>
          owner.current === id
            ? saveCloudLibrary(account.uid, previous, next)
            : undefined,
        )
        .then(() => {
          if (owner.current === id) {
            setStatus("Saved to your account");
            setWarning(undefined);
          }
        })
        .catch((error) => {
          if (owner.current === id) {
            setStatus("Saved on this device");
            setWarning(
              `Cloud save failed: ${error.message}. Your work remains on this device.`,
            );
            cloud.current = previous;
          }
        });
    }
  };
  const update = (
    next: LibraryState | ((state: LibraryState) => LibraryState),
  ) => {
    const stamped = stampLibrary(
      current.current,
      typeof next === "function" ? next(current.current) : next,
      Date.now(),
    );
    current.current = stamped;
    setState(stamped);
    persist(stamped);
  };
  useEffect(() => {
    let stopCloud: (() => void) | undefined;
    let generation = 0;
    const stopAuth = onIdTokenChanged(auth, async (account) => {
      const run = ++generation;
      stopCloud?.();
      ready.current = false;
      setUser(account?.isAnonymous ? null : account);
      const id = account && !account.isAnonymous ? account.uid : "guest";
      const wasGuest = owner.current === "guest";
      const guestState = wasGuest ? current.current : undefined;
      owner.current = id;
      if (!wasGuest && id === "guest") {
        current.current = initialLibrary();
        setState(current.current);
      }
      try {
        const saved = await localLibrary(id);
        if (run !== generation) return;
        const local =
          saved ?? (id === "guest" ? restored.state : initialLibrary());
        current.current =
          id !== "guest" && guestState
            ? mergeLibraries(guestState, local)
            : local;
        setState(current.current);
        void localLibrary(id, current.current).catch(() =>
          setWarning(
            "Device storage is unavailable. Your work remains in this page.",
          ),
        );
        if (id === "guest") {
          setStatus("Saved on this device");
          return;
        }
        setStatus("Connecting…");
        stopCloud = watchLibrary(
          id,
          (remote) => {
            if (run !== generation) return;
            cloud.current = remote;
            const merged = mergeLibraries(current.current, remote);
            current.current = merged;
            setState(merged);
            ready.current = true;
            persist(merged);
          },
          (error) => {
            if (run === generation) {
              setWarning(
                `Cloud library unavailable: ${error.message}. Your device copy is kept.`,
              );
              setStatus("Saved on this device");
            }
          },
        );
      } catch (error) {
        setWarning(
          error instanceof Error
            ? error.message
            : "Could not open device storage.",
        );
      }
    });
    return () => {
      generation++;
      stopAuth();
      stopCloud?.();
    };
  }, [restored.state]);
  return { state, update, user, warning, status };
};
