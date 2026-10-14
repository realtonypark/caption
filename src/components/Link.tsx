import type { AnchorHTMLAttributes } from "react";
import { navigate } from "../routing";

export const Link = ({
  href = "/",
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) => (
  <a
    {...props}
    href={href}
    onClick={(event) => {
      if (
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
