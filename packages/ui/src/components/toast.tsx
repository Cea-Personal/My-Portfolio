import type { ReactNode } from "react";

export function Toast({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-live="polite">
      {children}
    </div>
  );
}
