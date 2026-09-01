"use client";

import { useEffect, useState } from "react";

interface DashboardPayload {
  facts?: number;
  runs?: number;
  counts?: Partial<Record<string, number>>;
  actions?: readonly { type: string; label: string; href: string }[];
}

const metrics: readonly (readonly [string, keyof NonNullable<DashboardPayload["counts"]>])[] = [
  ["High-fit jobs", "highFitJobs"],
  ["Applications awaiting action", "applicationsAwaitingAction"],
  ["Upcoming interviews", "upcomingInterviews"],
  ["Preparation items", "pendingPreparation"],
  ["Reviewable facts", "reviewableFacts"],
  ["Portfolio activity", "portfolioActivity"],
  ["Draft content", "draftContent"]
];

export function DashboardSummary() {
  const [summary, setSummary] = useState<DashboardPayload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    void fetch("/api/v1/dashboard")
      .then(async (response) => {
        if (!response.ok) throw new Error("dashboard unavailable");
        const payload = (await response.json()) as { data?: DashboardPayload };
        if (active) {
          setSummary(payload.data ?? {});
          setState("ready");
        }
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  if (state === "loading") return <p role="status">Loading your career summary…</p>;
  if (state === "error") return <p role="alert">Sign in to view your private career summary.</p>;
  return (
    <section aria-labelledby="dashboard-summary-title">
      <h2 id="dashboard-summary-title">Action summary</h2>
      <dl>
        {metrics.map(([label, key]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{summary?.counts?.[key] ?? 0}</dd>
          </div>
        ))}
      </dl>
      {summary?.actions?.length ? (
        <ul>
          {summary.actions.map((action) => (
            <li key={`${action.type}:${action.href}`}>
              <a href={action.href}>{action.label}</a>
            </li>
          ))}
        </ul>
      ) : (
        <p>No action items yet.</p>
      )}
    </section>
  );
}
