"use client";

import { useEffect, useState } from "react";

function display(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

export function InterviewDetail({ id }: { id: string }) {
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let active = true;
    void fetch(`/api/v1/interview-processes/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("interview unavailable");
        const value = (await response.json()) as { data?: unknown };
        if (active) {
          setPayload(
            value.data && typeof value.data === "object"
              ? (value.data as Record<string, unknown>)
              : null
          );
          setState("ready");
        }
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, [id]);
  if (state === "loading")
    return (
      <main>
        <p role="status">Loading interview process…</p>
      </main>
    );
  if (state === "error")
    return (
      <main>
        <p role="alert">Sign in to load this interview process.</p>
      </main>
    );
  if (!payload)
    return (
      <main>
        <p>Interview process not found.</p>
      </main>
    );
  const stages = Array.isArray(payload.stages) ? payload.stages : [];
  return (
    <main>
      <h1>Interview process</h1>
      <p>Confidence: {display(payload.confidence, "low")}</p>
      {stages.length ? (
        <ol>
          {stages.map((stage, index) => {
            const row =
              stage && typeof stage === "object" ? (stage as Record<string, unknown>) : {};
            return (
              <li key={display(row.id, String(index))}>
                {display(row.name, "Stage")} · {display(row.status, "proposed")}
              </li>
            );
          })}
        </ol>
      ) : (
        <p>Interview Process Unknown — add a manual stage when evidence is insufficient.</p>
      )}
    </main>
  );
}
