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

it("preserves native navigation for external, new-tab, and download links", () => {
  const pushState = vi.spyOn(window.history, "pushState");
  const view = render(<Link href="https://example.com/">Open</Link>);
  const links = [
    <Link href="https://example.com/">Open</Link>,
    <Link href="/notepad" target="_blank">
      Open
    </Link>,
    <Link href="/notepad" target="reading-window">
      Open
    </Link>,
    <Link href="/notepad" download>
      Open
    </Link>,
  ];
  for (const link of links) {
    view.rerender(link);
    const event = new window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    // Observe React's handler before suppressing jsdom's unsupported native navigation.
    let intercepted = false;
    const anchor = screen.getByRole("link", { name: "Open" });
    const observe = (nativeEvent: Event) => {
      intercepted = nativeEvent.defaultPrevented;
      nativeEvent.preventDefault();
    };
    document.addEventListener("click", observe, { once: true });
    fireEvent(anchor, event);
    expect(intercepted).toBe(false);
  }
  expect(pushState).not.toHaveBeenCalled();
});
