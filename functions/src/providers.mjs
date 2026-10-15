import { readingMessages, streamEvents } from "./ai.mjs";
export const PROVIDERS = [
  {
    id: "openrouter",
    name: "OpenRouter",
    base: "https://openrouter.ai/api/v1",
  },
  { id: "openai", name: "OpenAI", base: "https://api.openai.com/v1" },
  { id: "anthropic", name: "Anthropic", base: "https://api.anthropic.com/v1" },
  { id: "meta", name: "Meta", base: "https://api.meta.ai/v1" },
];
export const providerInfo = (id) => {
  const provider = PROVIDERS.find((p) => p.id === id);
  if (!provider) throw new Error("Unknown provider.");
  return provider;
};
const headers = (id, key) => ({
  "Content-Type": "application/json",
  ...(id === "anthropic"
    ? { "x-api-key": key, "anthropic-version": "2023-06-01" }
    : { Authorization: `Bearer ${key}` }),
});
export const discoverModels = async (id, key, signal, request = fetch) => {
  const provider = providerInfo(id);
  const response = await request(`${provider.base}/models`, {
    headers: headers(id, key),
    signal,
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      response.status === 401 || response.status === 403
        ? "The key was rejected by this provider."
        : "Could not load models from this provider.",
    );
  }
  const data = await response.json();
  const models = (data.data ?? data.models ?? [])
    .filter((m) => {
      if (id === "openrouter")
        return (m.architecture?.output_modalities ?? ["text"]).includes("text");
      if (id === "openai")
        return (
          /^(gpt-|o[134]-|chatgpt-)/.test(m.id) &&
          !/audio|realtime|image|transcribe|search|tts/.test(m.id)
        );
      return id !== "meta" || /muse-(spark|wonder)/.test(m.id);
    })
    .map((m) => ({
      id: m.id,
      name: m.name || m.display_name || m.id,
      reasoning:
        m.supported_parameters?.includes("reasoning") ??
        /^(gpt-[56]|o[134]-|claude-(opus|sonnet)|muse-)/.test(m.id),
    }));
  if (!models.length)
    throw new Error("This account has no available reading models.");
  return models;
};
export const providerRequest = async (
  body,
  connection,
  key,
  signal,
  request = fetch,
) => {
  const provider = providerInfo(connection.provider);
  const model = connection.models.find((m) => m.id === body.model);
  if (!model || !connection.enabled.includes(model.id))
    throw new Error("Choose an enabled model from this connection.");
  const messages = readingMessages(body);
  let endpoint;
  let payload;
  if (provider.id === "openrouter") {
    endpoint = "chat/completions";
    payload = {
      model: model.id,
      messages,
      stream: true,
      max_tokens: 32768,
      ...(model.reasoning
        ? { reasoning: { effort: "max", exclude: true } }
        : {}),
    };
  } else if (provider.id === "anthropic") {
    endpoint = "messages";
    payload = {
      model: model.id,
      system: messages[0].content,
      messages: messages.slice(1),
      stream: true,
      max_tokens: 16384,
      ...(model.reasoning
        ? {
            thinking: { type: "adaptive" },
            output_config: { effort: /opus/.test(model.id) ? "max" : "high" },
          }
        : {}),
    };
  } else {
    endpoint = "responses";
    payload = {
      model: model.id,
      instructions: messages[0].content,
      input: messages.slice(1),
      stream: true,
      store: false,
      ...(model.reasoning
        ? {
            reasoning: {
              effort:
                provider.id === "meta"
                  ? "high"
                  : /^gpt-(6|5\.[245])/.test(model.id)
                    ? "xhigh"
                    : "high",
            },
          }
        : {}),
    };
  }
  const response = await request(`${provider.base}/${endpoint}`, {
    method: "POST",
    headers: headers(provider.id, key),
    body: JSON.stringify(payload),
    signal,
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      response.status === 401 || response.status === 403
        ? "This provider connection needs a new key."
        : `The selected provider could not answer (${response.status}). Your request was not sent to another provider.`,
    );
  }
  return {
    response,
    format:
      provider.id === "anthropic"
        ? "anthropic"
        : endpoint === "responses"
          ? "responses"
          : "chat",
  };
};
export async function* providerEvents(stream, format) {
  let completed = false;
  for await (const event of streamEvents(stream)) {
    if (
      event.error ||
      event.type === "error" ||
      event.type === "response.failed" ||
      event.type === "response.incomplete"
    )
      throw new Error("The provider interrupted this answer. Try again.");
    if (format === "chat") {
      yield event;
      if (event.choices?.[0]?.finish_reason) completed = true;
    } else if (format === "responses") {
      if (event.type === "response.output_text.delta")
        yield { choices: [{ delta: { content: event.delta } }] };
      if (event.type === "response.completed") {
        completed = true;
        yield {
          model: event.response?.model,
          choices: [{ finish_reason: "stop" }],
        };
      }
    } else {
      if (
        event.type === "content_block_delta" &&
        event.delta?.type === "text_delta"
      )
        yield { choices: [{ delta: { content: event.delta.text } }] };
      if (event.type === "message_start") yield { model: event.message?.model };
      if (
        event.type === "message_delta" &&
        event.delta?.stop_reason === "max_tokens"
      )
        throw new Error("The provider ran out of response space.");
      if (event.type === "message_stop") {
        completed = true;
        yield { choices: [{ finish_reason: "stop" }] };
      }
    }
  }
  if (!completed)
    throw new Error(
      "The provider connection ended before this answer completed.",
    );
}
