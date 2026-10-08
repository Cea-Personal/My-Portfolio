"use client";

import { useEffect, useState } from "react";
import type { DashboardGroup } from "@/lib/dashboard-actions";

interface DashboardPayload {
  groups?: DashboardGroup[];
  unavailable?: string[];
  scope?: string;
}

export function DashboardSummary() {
  const [summary, setSummary] = useState<DashboardPayload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "unauthorized">("loading");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    void fetch("/api/v1/dashboard", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          if (!controller.signal.aborted) setState("unauthorized");
          return;
        }
        if (!response.ok) throw new Error("dashboard unavailable");
        const payload = (await response.json()) as { data?: DashboardPayload };
        if (!controller.signal.aborted) {
          setSummary(payload.data ?? {});
          setState("ready");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => {
      controller.abort();
    };
  }, [refresh]);

  if (state === "loading") return <p role="status">Loading your next actions…</p>;
  if (state === "unauthorized")
    return (
      <p role="alert">
        <a href="/sign-in">Sign in</a> to view your private actions.
      </p>
    );
  if (state === "error")
    return (
      <div role="alert">
        <p>Your actions could not be loaded.</p>
        <button
          type="button"
          onClick={() => {
            setRefresh((value) => value + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  const groups = summary?.groups?.filter((group) => group.total > 0) ?? [];
  const unavailable = summary?.unavailable ?? [];

  return (
    <section aria-labelledby="dashboard-summary-title" className="today-queue">
      <div className="today-queue-heading">
        <h2 id="dashboard-summary-title">Work to move forward</h2>
        <button
          type="button"
          onClick={() => {
            setRefresh((value) => value + 1);
          }}
        >
          Refresh
        </button>
      </div>
      {unavailable.length > 0 ? (
        <p role="alert">
          Some actions could not be loaded: {unavailable.join(", ")}. Refresh or open the relevant
          workspace.
        </p>
      ) : null}
      {groups.length ? (
        <div className="today-groups">
          {groups.map((group) => (
            <section key={group.id} className="today-group" aria-labelledby={`today-${group.id}`}>
              <header>
                <h3 id={`today-${group.id}`}>{group.title}</h3>
                <span aria-label={`${String(group.total)} actions`}>{group.total}</span>
              </header>
              <ul>
                {group.items.map((action) => (
                  <li key={action.id}>
                    <a href={action.href}>
                      {action.label}
                      <span aria-hidden="true"> ↗</span>
                    </a>
                    <p>{action.detail}</p>
                    {action.scheduledAt ? (
                      <time dateTime={action.scheduledAt}>
                        {new Date(action.scheduledAt).toLocaleString()}
                      </time>
                    ) : null}
                  </li>
                ))}
              </ul>
              <a className="today-view-all" href={group.href}>
                Open workspace
                {group.total > group.items.length
                  ? ` · ${String(group.total - group.items.length)} more`
                  : ""}{" "}
                →
              </a>
            </section>
          ))}
        </div>
      ) : (
        <p>
          {unavailable.length
            ? "The loaded workspaces have no pending actions."
            : "No pending actions in your recent records. Explore opportunities or continue in a workspace."}
        </p>
      )}
      <p className="today-scope">
        {summary?.scope} Follow-ups are review prompts, not tracked deadlines.
      </p>
      <nav className="today-shortcuts" aria-label="Start work">
        <a href="/jobs">Find jobs</a>
        <a href="/applications">Applications</a>
        <a href="/freelance">Freelance work</a>
      </nav>
    </section>
  );
}
