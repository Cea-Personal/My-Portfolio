import type { ReactNode } from "react";

export function Status({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <span role="status" data-tone={tone}>
      {children}
    </span>
  );
}
