import { initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  signInAnonymously,
  signInWithPopup,
  linkWithPopup,
  signInWithCredential,
  signOut,
  type AuthError,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { firebaseConfig } from "../firebase-config";

const app = initializeApp(firebaseConfig);
export const analytics: Promise<Analytics | null> = isSupported()
  .then((supported) =>
    supported && import.meta.env.PROD ? getAnalytics(app) : null,
  )
  .catch(() => null);
export const auth = getAuth(app);
export const database = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
if (import.meta.env.VITE_FIREBASE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(database, "127.0.0.1", 8080);
}
let guest: Promise<unknown> | undefined;
export const session = async () => {
  await auth.authStateReady();
  if (!auth.currentUser) {
    guest ??= signInAnonymously(auth).finally(() => {
      guest = undefined;
    });
    await guest;
  }
  if (!auth.currentUser)
    throw new Error("Could not start your reading session. Please reload.");
  return auth.currentUser;
};
export const googleSignIn = async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const user = auth.currentUser;
  if (!user?.isAnonymous) return signInWithPopup(auth, provider);
  try {
    return await linkWithPopup(user, provider);
  } catch (error) {
    if ((error as AuthError).code !== "auth/credential-already-in-use")
      throw error;
    const credential = GoogleAuthProvider.credentialFromError(
      error as AuthError,
    );
    if (!credential) throw error;
    return signInWithCredential(auth, credential);
  }
};
export const googleSignOut = () => signOut(auth);
export const apiRequest = async (
  path: string,
  body: unknown,
  signal?: AbortSignal,
) => {
  const user = await session();
  const base =
    import.meta.env.VITE_FIREBASE_EMULATORS === "true"
      ? "http://127.0.0.1:5001/caption-purple/us-central1/api"
      : "";
  const response = await fetch(`${base}/api/${path}`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await user.getIdToken()}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => ({ error: `Request failed (${response.status}).` }));
    throw new Error(data.error || "The reading service could not respond.");
  }
  return response;
};
