import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Link } from "./Link";
import type { MouseEvent } from "react";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

it("runs the caller's click handler before navigation and respects its cancellation", () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const beforeNavigation = vi.fn((event: MouseEvent<HTMLAnchorElement>) => {
    expect(event.defaultPrevented).toBe(false);
    expect(window.location.pathname).toBe("/");
  });
  const view = render(
    <Link href="/notepad" onClick={beforeNavigation}>
      Open
    </Link>,
  );
  fireEvent.click(screen.getByRole("link", { name: "Open" }));
  expect(beforeNavigation).toHaveBeenCalledOnce();
  expect(window.location.pathname).toBe("/notepad");

  const cancel = vi.fn((event: MouseEvent<HTMLAnchorElement>) =>
    event.preventDefault(),
  );
  view.rerender(
    <Link href="/read/quiet-work" onClick={cancel}>
      Open
    </Link>,
  );
  fireEvent.click(screen.getByRole("link", { name: "Open" }));
  expect(cancel).toHaveBeenCalledOnce();
  expect(window.location.pathname).toBe("/notepad");
});
