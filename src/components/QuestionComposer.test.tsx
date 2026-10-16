import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { QuestionComposer } from "./QuestionComposer";

afterEach(cleanup);

it("swaps the send button for a stop button while an answer streams", () => {
  const onStop = vi.fn();
  const { rerender } = render(
    <QuestionComposer inputRef={{ current: null }} onAsk={vi.fn()} onStop={onStop}>
      <span />
    </QuestionComposer>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Stop answer" }));
  expect(onStop).toHaveBeenCalled();
  expect(
    screen.queryByRole("button", { name: "Ask about the whole text" }),
  ).not.toBeInTheDocument();
  rerender(
    <QuestionComposer inputRef={{ current: null }} onAsk={vi.fn()}>
      <span />
    </QuestionComposer>,
  );
  expect(
    screen.getByRole("button", { name: "Ask about the whole text" }),
  ).toBeInTheDocument();
});
