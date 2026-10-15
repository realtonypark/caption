import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import { sealCredential, openCredential } from "./provider-crypto.mjs";
import { discoverModels, providerInfo } from "./providers.mjs";
const collection = (uid) =>
  getFirestore()
    .collection("providerAccounts")
    .doc(uid)
    .collection("connections");
const publicConnection = (snapshot) => {
  const { credential, ...data } = snapshot.data();
  void credential;
  return { id: snapshot.id, ...data };
};
export const providerCommand = async (uid, body, encryptionKey, signal) => {
  const connections = collection(uid);
  if (body.command === "list")
    return {
      connections: (await connections.get()).docs.map(publicConnection),
    };
  if (body.command === "connect") {
    providerInfo(body.provider);
    if (
      typeof body.key !== "string" ||
      body.key.length < 10 ||
      body.key.length > 4000
    )
      throw new Error("Enter a valid API key.");
    const models = await discoverModels(body.provider, body.key.trim(), signal);
    const id = body.id || randomUUID();
    if (typeof id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(id))
      throw new Error("Invalid connection.");
    const existing = await connections.doc(id).get();
    if (existing.exists && existing.data().provider !== body.provider)
      throw new Error("Cannot change a connection provider.");
    const previousEnabled = existing
      .data()
      ?.enabled?.filter((id) => models.some((model) => model.id === id));
    const enabled = previousEnabled?.length
      ? previousEnabled
      : models.slice(0, 3).map((m) => m.id);
    await connections.doc(id).set({
      provider: body.provider,
      name: providerInfo(body.provider).name,
      kind: "api",
      models,
      enabled,
      credential: sealCredential(
        { key: body.key.trim() },
        encryptionKey,
        `${uid}:${id}`,
      ),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { connection: publicConnection(await connections.doc(id).get()) };
  }
  if (typeof body.id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(body.id))
    throw new Error("Invalid connection.");
  const reference = connections.doc(body.id);
  const snapshot = await reference.get();
  if (!snapshot.exists) throw new Error("This connection was removed.");
  if (body.command === "disconnect") {
    await reference.delete();
    return { ok: true };
  }
  if (body.command === "models") {
    const allowed = snapshot.data().models;
    if (
      !Array.isArray(body.enabled) ||
      !body.enabled.length ||
      body.enabled.some((id) => !allowed.some((model) => model.id === id))
    )
      throw new Error("Keep at least one available model enabled.");
    await reference.update({
      enabled: [...new Set(body.enabled)],
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { connection: publicConnection(await reference.get()) };
  }
  throw new Error("Unknown provider action.");
};
export const connectedProvider = async (uid, id, encryptionKey) => {
  if (typeof id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(id))
    throw new Error("Invalid connection.");
  const snapshot = await collection(uid).doc(id).get();
  if (!snapshot.exists) throw new Error("Reconnect this provider in Models.");
  const connection = publicConnection(snapshot);
  return {
    connection,
    key: openCredential(
      snapshot.data().credential,
      encryptionKey,
      `${uid}:${id}`,
    ).key,
  };
};
