import type { Reading, Passage, Exchange, ReadingAction } from "../reading";
import { READING_ACTIONS } from "../reading";
import { apiRequest } from "./firebase";
export { FREE_MODELS } from "../../functions/src/models.mjs";

export interface AnswerRequest {
  reading: Reading;
  passage: Passage;
  action: ReadingAction;
  question: string;
  scope: "passage" | "text";
  history: Exchange[];
  model: string;
  web: boolean;
  signal: AbortSignal;
  onText: (text: string) => void;
}
export const requestAnswer = async (
  options: AnswerRequest,
): Promise<Exchange> => {
  const {
    reading,
    passage,
    question,
    action,
    scope,
    history,
    model,
    web,
    signal,
    onText,
  } = options;
  const response = await apiRequest(
    "ask",
    {
      title: reading.title,
      paragraphs: reading.paragraphs.map((p) => p.text),
      quote: passage.quote,
      question,
      action,
      scope,
      model,
      web,
      history: history.flatMap((e) => [
        { role: "user", content: e.question },
        { role: "assistant", content: e.answer },
      ]),
    },
    signal,
  );
  if (!response.body) throw new Error("The answer stream is unavailable.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let end;
      while ((end = buffer.indexOf("\n\n")) >= 0) {
        const event = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const line = event.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        const data = JSON.parse(line.slice(6));
        if (data.type === "error") throw new Error(data.message);
        if (data.type === "text") {
          answer += data.text;
          onText(answer);
        }
        if (data.type === "done")
          return {
            question,
            action,
            scope,
            answer,
            model: data.model,
            paragraphs: data.paragraphs,
            sources: data.sources,
          };
      }
    }
    throw new Error(
      "The connection ended before the answer finished. Try again.",
    );
  } finally {
    await reader.cancel();
  }
};
export const questionFor = (action: ReadingAction, question?: string) =>
  question?.trim() || READING_ACTIONS[action].question;
