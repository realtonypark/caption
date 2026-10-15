import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { providerCommand, connectedProvider } from "./provider-store.mjs";
if (!process.env.FIRESTORE_EMULATOR_HOST)
  throw new Error("Run against the Firestore emulator only.");
initializeApp({ projectId: "caption-purple" });
const key = (
  await readFile(new URL("../.secret.local", import.meta.url), "utf8")
).match(/^OPENROUTER_KEY=(.+)$/m)[1];
const encryption = randomBytes(32).toString("base64");
const owner = "provider-integration";
const connected = await providerCommand(
  owner,
  { command: "connect", provider: "openrouter", key },
  encryption,
  AbortSignal.timeout(15000),
);
const connection = connected.connection;
try {
  assert.ok(connection.models.length > 0);
  assert.equal(connection.credential, undefined);
  const list = await providerCommand(owner, { command: "list" }, encryption);
  assert.equal(JSON.stringify(list).includes(key), false);
  const resolved = await connectedProvider(owner, connection.id, encryption);
  assert.equal(resolved.key, key);
  await assert.rejects(
    connectedProvider("another-account", connection.id, encryption),
    /Reconnect/,
  );
  const updated = await providerCommand(
    owner,
    {
      command: "models",
      id: connection.id,
      enabled: [connection.models[0].id],
    },
    encryption,
  );
  assert.equal(updated.connection.enabled.length, 1);
  assert.equal(
    JSON.stringify(
      (
        await getFirestore()
          .collection("providerAccounts")
          .doc(owner)
          .collection("connections")
          .doc(connection.id)
          .get()
      ).data(),
    ).includes(key),
    false,
  );
  console.log(
    "Live OpenRouter model discovery, encrypted storage, account isolation, and model selection passed.",
  );
} finally {
  await providerCommand(
    owner,
    { command: "disconnect", id: connection.id },
    encryption,
  );
}
