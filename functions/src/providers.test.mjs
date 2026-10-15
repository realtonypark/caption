import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { sealCredential, openCredential } from "./provider-crypto.mjs";
import {
  discoverModels,
  providerRequest,
  providerEvents,
} from "./providers.mjs";
const body = {
  title: "A reading",
  paragraphs: ["Context supports an idea."],
  question: "Why?",
  quote: "Context",
  action: "ask",
  scope: "passage",
  history: [],
  model: "model",
};
test("encrypts credentials with account and connection binding", () => {
  const key = randomBytes(32).toString("base64");
  const secret = { key: "private-provider-key" };
  const sealed = sealCredential(secret, key, "account:connection");
  assert.equal(JSON.stringify(sealed).includes(secret.key), false);
  assert.deepEqual(openCredential(sealed, key, "account:connection"), secret);
  assert.throws(() => openCredential(sealed, key, "another:connection"));
  assert.throws(() =>
    openCredential(
      { ...sealed, tag: randomBytes(16).toString("base64") },
      key,
      "account:connection",
    ),
  );
});
test("validates keys through provider model discovery and never forwards arbitrary endpoints", async () => {
  const models = await discoverModels(
    "openrouter",
    "private-key",
    undefined,
    async (url) => {
      if (url === "https://openrouter.ai/api/v1/key")
        return Response.json({ data: {} });
      assert.equal(url, "https://openrouter.ai/api/v1/models");
      return Response.json({
        data: [
          {
            id: "model",
            name: "Readable",
            architecture: { output_modalities: ["text"] },
            supported_parameters: ["reasoning"],
          },
          { id: "image", architecture: { output_modalities: ["image"] } },
        ],
      });
    },
  );
  assert.deepEqual(models, [
    { id: "model", name: "Readable", reasoning: true },
  ]);
  await assert.rejects(
    discoverModels("openrouter", "bad-key", undefined, async (url) => {
      assert.equal(url, "https://openrouter.ai/api/v1/key");
      return new Response("", { status: 401 });
    }),
    /rejected/,
  );
  await assert.rejects(
    discoverModels("http://private.host", "key"),
    /Unknown provider/,
  );
  await assert.rejects(
    discoverModels(
      "openai",
      "key",
      undefined,
      async () => new Response("", { status: 401 }),
    ),
    /rejected/,
  );
});
test("discovers all Anthropic pages and sends only supported thinking and effort", async () => {
  const models = await discoverModels(
    "anthropic",
    "key",
    undefined,
    async (url) =>
      Response.json(
        url.includes("after_id=")
          ? { data: [{ id: "old-model", max_tokens: 4096 }], has_more: false }
          : {
              data: [
                {
                  id: "adaptive-model",
                  max_tokens: 64000,
                  capabilities: {
                    thinking: {
                      supported: true,
                      types: { adaptive: { supported: true } },
                    },
                    effort: {
                      max: { supported: false },
                      high: { supported: true },
                    },
                  },
                },
                {
                  id: "extended-model",
                  max_tokens: 8192,
                  capabilities: {
                    thinking: {
                      supported: true,
                      types: { enabled: { supported: true } },
                    },
                  },
                },
              ],
              has_more: true,
              last_id: "extended-model",
            },
      ),
  );
  assert.equal(models.length, 3);
  for (const model of models) {
    await providerRequest(
      { ...body, model: model.id },
      { provider: "anthropic", models, enabled: models.map((m) => m.id) },
      "key",
      undefined,
      async (_url, options) => {
        const sent = JSON.parse(options.body);
        if (model.id === "adaptive-model") {
          assert.deepEqual(sent.thinking, { type: "adaptive" });
          assert.deepEqual(sent.output_config, { effort: "high" });
          assert.equal(sent.max_tokens, 32768);
        } else if (model.id === "extended-model") {
          assert.deepEqual(sent.thinking, {
            type: "enabled",
            budget_tokens: 7168,
          });
          assert.equal(sent.output_config, undefined);
        } else {
          assert.equal(sent.thinking, undefined);
          assert.equal(sent.output_config, undefined);
          assert.equal(sent.max_tokens, 4096);
        }
        return new Response("");
      },
    );
  }
});
test("uses each provider protocol without search or cross-provider fallback", async () => {
  for (const provider of ["openrouter", "openai", "anthropic", "meta"]) {
    const connection = {
      provider,
      models: [{ id: "model", reasoning: false }],
      enabled: ["model"],
    };
    await providerRequest(
      { ...body, web: true },
      connection,
      "key",
      undefined,
      async (url, options) => {
        const sent = JSON.parse(options.body);
        assert.equal(sent.plugins, undefined);
        assert.equal(sent.tools, undefined);
        assert.equal(sent.models, undefined);
        assert.equal(sent.stream, true);
        if (provider === "openrouter")
          assert.ok(url.endsWith("/chat/completions"));
        else if (provider === "anthropic") {
          assert.ok(url.endsWith("/messages"));
          assert.equal(options.headers["x-api-key"], "key");
        } else {
          assert.ok(url.endsWith("/responses"));
          assert.equal(sent.store, false);
        }
        return new Response("");
      },
    );
    await assert.rejects(
      providerRequest(
        body,
        connection,
        "key",
        undefined,
        async () => new Response("", { status: 429 }),
      ),
      /not sent to another/,
    );
  }
});
test("normalizes Responses and Anthropic streaming and rejects incomplete answers", async () => {
  for (const [format, events] of [
    [
      "responses",
      [
        { type: "response.output_text.delta", delta: "Answer" },
        { type: "response.completed", response: { model: "model" } },
      ],
    ],
    [
      "anthropic",
      [
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Answer" },
        },
        { type: "message_stop" },
      ],
    ],
  ]) {
    const stream = new Response(
      events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(""),
    ).body;
    const output = [];
    for await (const event of providerEvents(stream, format))
      output.push(event);
    assert.equal(output[0].choices[0].delta.content, "Answer");
  }
  await assert.rejects(async () => {
    for await (const event of providerEvents(
      new Response(
        'data: {"type":"response.output_text.delta","delta":"Partial"}\n\n',
      ).body,
      "responses",
    ))
      void event;
  }, /before.*completed/);
});
