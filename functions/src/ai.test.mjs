import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateQuestion,
  answerRequest,
  readingMessages,
  streamEvents,
} from "./ai.mjs";
const body = {
  title: "Reading",
  paragraphs: ["An idea needs its evidence.", "A note preserves its context."],
  quote: "An idea",
  question: "Why?",
  action: "ask",
  scope: "passage",
  history: [],
  model: "thinkingmachines/inkling:free",
  web: false,
};
test("validates document boundaries and keeps conversation history in order", () => {
  assert.equal(validateQuestion(body), body);
  assert.throws(
    () => validateQuestion({ ...body, quote: "Not in the reading" }),
    /selected passage/,
  );
  assert.throws(
    () => validateQuestion({ ...body, action: "unknown" }),
    /invalid/,
  );
  const messages = readingMessages({
    ...body,
    question: "An example?",
    history: [
      { role: "user", content: "Why?" },
      { role: "assistant", content: "Because context matters." },
    ],
  });
  assert.deepEqual(
    messages.slice(1).map((m) => m.role),
    ["user", "assistant", "user"],
  );
  assert.equal(messages.at(-1).content, "An example?");
  assert.match(messages[0].content, /untrusted/);
});
test("routes a named model to the free fallback with maximum reasoning", async () => {
  let sent;
  await answerRequest(body, "test-key", undefined, async (_url, options) => {
    sent = JSON.parse(options.body);
    return new Response("");
  });
  assert.deepEqual(sent.models, [
    "thinkingmachines/inkling:free",
    "openrouter/free",
  ]);
  assert.equal(sent.reasoning.effort, "max");
  assert.equal(sent.stream, true);
  await assert.rejects(
    answerRequest(
      body,
      "test-key",
      undefined,
      async () => new Response("", { status: 429 }),
    ),
    /free AI limit/,
  );
});
test("decodes UTF-8 and events split across stream chunks, and rejects malformed events", async () => {
  const bytes = new TextEncoder().encode(
    'data: {"choices":[{"delta":{"content":"생각"}}]}\r\n\r\ndata: [DONE]\n\n',
  );
  const stream = new ReadableStream({
    start(c) {
      for (let i = 0; i < bytes.length; i += 2)
        c.enqueue(bytes.slice(i, i + 2));
      c.close();
    },
  });
  const result = [];
  for await (const event of streamEvents(stream)) result.push(event);
  assert.equal(result[0].choices[0].delta.content, "생각");
  await assert.rejects(async () => {
    for await (const event of streamEvents(
      new Response("data: broken\n\n").body,
    ))
      void event;
  }, SyntaxError);
});
