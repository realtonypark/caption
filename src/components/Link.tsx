import type { AnchorHTMLAttributes } from "react";
import { navigate } from "../routing";

export const Link = ({
  href = "/",
  children,
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) => (
  <a
    {...props}
    href={href}
    onClick={(event) => {
      onClick?.(event);
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      event.preventDefault();
      navigate(href);
    }}
  >
    {children}
  </a>
);
