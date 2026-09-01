import type { ReactNode, TableHTMLAttributes } from "react";

export function Table({
  children,
  ...props
}: TableHTMLAttributes<HTMLTableElement> & { children: ReactNode }) {
  return (
    <div role="region" tabIndex={0} aria-label="Data table">
      <table {...props}>{children}</table>
    </div>
  );
}
