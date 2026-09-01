import type { ReactNode } from "react";

export function Tabs({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="tablist" aria-label={label}>
      {children}
    </div>
  );
}
