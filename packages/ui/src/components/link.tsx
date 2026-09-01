import type { AnchorHTMLAttributes } from "react";

export function Link({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props}>{children}</a>;
}
