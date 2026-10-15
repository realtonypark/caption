import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, Timestamp } from "firebase/firestore";
const env = await initializeTestEnvironment({
  projectId: "caption-ai-tpark",
  firestore: {
    host: "127.0.0.1",
    port: 8080,
    rules: await readFile("firestore.rules", "utf8"),
  },
});
try {
  const owner = env
    .authenticatedContext("owner", {
      firebase: { sign_in_provider: "google.com" },
    })
    .firestore();
  const stranger = env
    .authenticatedContext("stranger", {
      firebase: { sign_in_provider: "google.com" },
    })
    .firestore();
  const guest = env
    .authenticatedContext("guest", {
      firebase: { sign_in_provider: "anonymous" },
    })
    .firestore();
  const data = {
    value: { title: "Private source" },
    updatedAt: Timestamp.now(),
    deleted: false,
  };
  await assertSucceeds(setDoc(doc(owner, "users/owner/readings/source"), data));
  await assertSucceeds(getDoc(doc(owner, "users/owner/readings/source")));
  await assertFails(getDoc(doc(stranger, "users/owner/readings/source")));
  await assertFails(setDoc(doc(guest, "users/guest/readings/source"), data));
  await assertFails(getDoc(doc(owner, "providers/secret")));
  await assertFails(setDoc(doc(owner, "quotas/bypass"), { count: 0 }));
  console.log(
    "Account isolation, Google-only cloud persistence, and server-only data rules passed.",
  );
} finally {
  await env.cleanup();
}
