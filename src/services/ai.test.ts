import { expect, it, vi, afterEach } from "vitest";
import { requestAnswer } from "./ai";
import { apiRequest } from "./firebase";
import { initialLibrary, wholeParagraph } from "../reading";
vi.mock("./firebase", () => ({ apiRequest: vi.fn() }));
afterEach(() => vi.clearAllMocks());
it("streams an answer, preserves thread history, and reports an incomplete stream", async () => {
  const reading = {
    ...initialLibrary().readings[0],
    paragraphs: [
      {
        text: "Context supports an idea.",
        explanation: "",
        heading: "Memory and attention",
      },
      { text: "A note helps us revisit it.", explanation: "" },
    ],
  };
  const options = {
    reading,
    passage: wholeParagraph(reading, 0),
    action: "ask" as const,
    scope: "passage" as const,
    question: "An example?",
    model: "openrouter/free",
    history: [
      { question: "Why?", answer: "Because context matters.", paragraphs: [1] },
    ],
    signal: new AbortController().signal,
    onText: vi.fn(),
  };
  vi.mocked(apiRequest).mockResolvedValue(
    new Response(
      'data: {"type":"text","text":"Context."}\n\ndata: {"type":"done","model":"openrouter/free","paragraphs":[1],"sources":[]}\n\n',
    ),
  );
  expect((await requestAnswer(options)).answer).toBe("Context.");
  expect(options.onText).toHaveBeenCalledWith("Context.");
  expect(vi.mocked(apiRequest).mock.calls[0][1]).toMatchObject({
    headings: ["Memory and attention", ""],
    history: [
      { role: "user", content: "Why?" },
      { role: "assistant", content: "Because context matters." },
    ],
  });
  vi.mocked(apiRequest).mockResolvedValue(
    new Response('data: {"type":"text","text":"Partial"}\n\n'),
  );
  await expect(requestAnswer(options)).rejects.toThrow(
    "before the answer finished",
  );
});
