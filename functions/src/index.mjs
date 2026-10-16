import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { downloadSource, extractArticle } from "./import.mjs";
import { providerCommand, connectedProvider } from "./provider-store.mjs";
import { providerRequest, providerEvents } from "./providers.mjs";
import { answerRequest, validateQuestion, FREE_MODELS } from "./ai.mjs";

initializeApp();
const key = defineSecret("OPENROUTER_KEY");
const encryptionKey = defineSecret("PROVIDER_ENCRYPTION_KEY");
const db = getFirestore();
const hash = (text) => createHash("sha256").update(text).digest("hex");
const quota = async (ids, caps) => {
  const now = Date.now();
  await db.runTransaction(async (transaction) => {
    const refs = ids.map((id) => db.collection("quotas").doc(id));
    const snapshots = await transaction.getAll(...refs);
    if (
      snapshots.some((snapshot, i) => (snapshot.data()?.count ?? 0) >= caps[i])
    ) {
      const error = new Error(
        "Reading service limit reached. Please try again later.",
      );
      error.status = 429;
      throw error;
    }
    refs.forEach((ref) =>
      transaction.set(
        ref,
        {
          count: FieldValue.increment(1),
          expiresAt: new Date(now + 2 * 86400000),
        },
        { merge: true },
      ),
    );
  });
};
const limit = async (uid, ip, kind) => {
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const day = Math.floor(now / 86400000);
  const caps = kind === "ask" ? [6, 30, 1000] : [10, 100, 5000];
  await quota(
    [
      `${kind}-user-${hash(uid)}-${minute}`,
      `${kind}-ip-${hash(ip)}-${day}`,
      `${kind}-all-${day}`,
    ],
    caps,
  );
};
const limitPersonal = async (uid) => {
  const minute = Math.floor(Date.now() / 60000);
  await quota([`personal-ask-user-${hash(uid)}-${minute}`], [6]);
};
export const api = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 300,
    memory: "512MiB",
    maxInstances: 3,
    secrets: [key, encryptionKey],
    cors: [
      "https://caption-purple.web.app",
      "https://caption-purple.firebaseapp.com",
      /^http:\/\/(localhost|127\.0\.0\.1):\d+$/,
    ],
  },
  async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (req.method === "GET" && req.path.endsWith("/health")) {
      res.json({ ok: true });
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Use POST." });
      return;
    }
    const controller = new AbortController();
    res.on("close", () => controller.abort());
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(280000),
    ]);
    try {
      const bearer = /^Bearer (.+)$/.exec(req.get("authorization") ?? "");
      if (!bearer) {
        res.status(401).json({ error: "Reload Caption to reconnect." });
        return;
      }
      let identity;
      try {
        identity = await getAuth().verifyIdToken(bearer[1]);
      } catch {
        res
          .status(401)
          .json({ error: "Your session expired. Reload Caption." });
        return;
      }
      if (Buffer.byteLength(JSON.stringify(req.body ?? {})) > 3_000_000) {
        res.status(413).json({ error: "This request is too large." });
        return;
      }
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      if (req.path.endsWith("/providers")) {
        if (identity.firebase?.sign_in_provider !== "google.com") {
          res.status(403).json({
            error: "Continue with Google to save a provider connection.",
          });
          return;
        }
        if (!req.body || typeof req.body.command !== "string") {
          res.status(400).json({ error: "Unknown provider action." });
          return;
        }
        if (["list", "connect"].includes(req.body.command))
          await limit(identity.uid, ip, "import");
        res.json(
          await providerCommand(
            identity.uid,
            req.body,
            encryptionKey.value(),
            signal,
          ),
        );
        return;
      }
      if (req.path.endsWith("/import")) {
        if (typeof req.body?.url !== "string" || req.body.url.length > 2048) {
          res.status(400).json({ error: "Enter a valid web link." });
          return;
        }
        await limit(identity.uid, ip, "import");
        const source = await downloadSource(
          req.body.url,
          AbortSignal.any([signal, AbortSignal.timeout(30000)]),
        );
        if (source.type.includes("application/pdf")) {
          res.set("Content-Type", "application/pdf");
          res.set("X-Source-URL", source.url);
          res.set("Access-Control-Expose-Headers", "X-Source-URL");
          res.send(source.bytes);
        } else
          res.json(
            await extractArticle(source.bytes.toString("utf8"), source.url),
          );
        return;
      }
      if (!req.path.endsWith("/ask")) {
        res.status(404).json({ error: "Not found." });
        return;
      }
      let body;
      try {
        body = validateQuestion(req.body);
      } catch (error) {
        res.status(400).json({ error: error.message });
        return;
      }
      let response;
      let format = "chat";
      if (body.connectionId !== undefined) {
        if (identity.firebase?.sign_in_provider !== "google.com") {
          res
            .status(403)
            .json({ error: "Sign in to use this provider connection." });
          return;
        }
        await limitPersonal(identity.uid);
        const provider = await connectedProvider(
          identity.uid,
          body.connectionId,
          encryptionKey.value(),
        );
        ({ response, format } = await providerRequest(
          body,
          provider.connection,
          provider.key,
          signal,
        ));
      } else {
        await limit(identity.uid, ip, "ask");
        response = await answerRequest(body, key.value(), signal);
      }
      res.set("Content-Type", "text/event-stream; charset=utf-8");
      res.set("X-Accel-Buffering", "no");
      res.flushHeaders();
      const send = (value) => res.write(`data: ${JSON.stringify(value)}\n\n`);
      let text = "";
      let actualModel = body.model || FREE_MODELS[0].id;
      let sources = [];
      const paragraphCount = body.paragraphs.length;
      const cleanMarkers = (value) =>
        value.replace(/\[¶(\d+)\]/g, (marker, digits) =>
          Number(digits) >= 1 && Number(digits) <= paragraphCount ? marker : "",
        );
      let held = "";
      const sendText = (content) => {
        const combined = held + content;
        held = "";
        const open = combined.lastIndexOf("[");
        if (open >= 0) {
          const tail = combined.slice(open);
          if (
            !tail.includes("]") &&
            tail.length <= 16 &&
            /\[¶?\d*$/.test(tail)
          ) {
            held = tail;
            const flush = cleanMarkers(combined.slice(0, open));
            if (flush) {
              text += flush;
              send({ type: "text", text: flush });
            }
            return;
          }
        }
        const cleaned = cleanMarkers(combined);
        if (cleaned) {
          text += cleaned;
          send({ type: "text", text: cleaned });
        }
      };
      const heartbeat = setInterval(() => res.write(": keepalive\n\n"), 15000);
      try {
        for await (const event of providerEvents(response.body, format)) {
          if (event.error)
            throw new Error("The model stopped before finishing. Try again.");
          if (event.model) actualModel = event.model;
          const message = event.choices?.[0]?.delta;
          if (message?.annotations)
            sources.push(
              ...message.annotations
                .filter((a) => a.type === "url_citation")
                .map((a) => a.url_citation),
            );
          const content = message?.content;
          if (typeof content === "string") sendText(content);
          if (event.choices?.[0]?.finish_reason === "length")
            throw new Error(
              "The model ran out of space. Try a shorter question.",
            );
        }
        if (held) {
          const cleaned = cleanMarkers(held);
          held = "";
          if (cleaned) {
            text += cleaned;
            send({ type: "text", text: cleaned });
          }
        }
        if (!text.trim())
          throw new Error("The model returned no answer. Try another model.");
        const citations = [
          ...new Set(
            [...text.matchAll(/\[¶(\d+)\]/g)].map((m) => Number(m[1])),
          ),
        ].filter((n) => n >= 1 && n <= body.paragraphs.length);
        send({
          type: "done",
          model: actualModel,
          paragraphs: citations,
          sources,
        });
      } finally {
        clearInterval(heartbeat);
      }
      res.end();
    } catch (error) {
      if (signal.aborted) {
        if (!res.destroyed) res.end();
        return;
      }
      const message =
        error.message || "The service could not complete this request.";
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", message })}\n\n`);
        res.end();
      } else res.status(error.status || 502).json({ error: message });
    }
  },
);
