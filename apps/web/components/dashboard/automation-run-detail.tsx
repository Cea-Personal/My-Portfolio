"use client";

import { useEffect, useState } from "react";

function display(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

export function AutomationRunDetail({ id }: { id: string }) {
  const [run, setRun] = useState<Record<string, unknown> | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let active = true;
    void fetch(`/api/v1/automation-runs/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("run unavailable");
        const payload = (await response.json()) as { data?: unknown };
        if (active) {
          setRun(
            payload.data && typeof payload.data === "object"
              ? (payload.data as Record<string, unknown>)
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
        <p role="status">Loading automation run…</p>
      </main>
    );
  if (state === "error")
    return (
      <main>
        <p role="alert">Sign in to load this automation run.</p>
      </main>
    );
  if (!run)
    return (
      <main>
        <p>Automation run not found.</p>
      </main>
    );
  const steps = Array.isArray(run.automation_run_steps) ? run.automation_run_steps : [];
  return (
    <main>
      <h1>Automation run</h1>
      <p>Status: {display(run.status, "pending")}</p>
      <p>Workflow: {display(run.workflow_name, "bounded workflow")}</p>
      {steps.length ? (
        <ol>
          {steps.map((step, index) => {
            const row = step && typeof step === "object" ? (step as Record<string, unknown>) : {};
            return (
              <li key={display(row.id, String(index))}>
                {display(row.step_name, "Step")} · {display(row.status, "pending")}
              </li>
            );
          })}
        </ol>
      ) : (
        <p>No workflow steps recorded yet.</p>
      )}
    </main>
  );
}
