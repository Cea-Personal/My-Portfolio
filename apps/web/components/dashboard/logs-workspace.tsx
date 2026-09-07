"use client";
import { useCallback, useEffect, useState } from "react";

interface LogEntry {
  id: string;
  kind: "portfolio_visit" | "ai_run" | "system";
  category: string;
  status: "success" | "failure" | "info";
  occurredAt: string;
  title: string;
  summary: string;
  source: string;
  details: Record<string, unknown>;
}

const filters = [
  ["all", "All logs"],
  ["page_view", "Portfolio page views"],
  ["system_error", "System errors"],
  ["failure", "Failures"],
  ["success", "Successes"],
  ["system", "System actions"],
  ["ai_run", "AI runs"]
] as const;

function display(value: string): string {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}
function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}
function duration(seconds: number): string {
  if (seconds < 60) return `${String(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${String(minutes)}m ${String(rest)}s` : `${String(minutes)}m`;
}
function detailValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "—";
  return JSON.stringify(value);
}

function PortfolioDetails({ details }: { details: Record<string, unknown> }) {
  const sections = Array.isArray(details.sections)
    ? details.sections.filter((x): x is string => typeof x === "string")
    : [];
  const sectionTime = (details.sectionTimeSeconds ?? {}) as Record<string, unknown>;
  const pages = Array.isArray(details.pages)
    ? details.pages.filter((x): x is string => typeof x === "string")
    : [];
  return (
    <div className="analytics-visit-accordion-body">
      <p>
        Stayed for{" "}
        <strong>
          {duration(
            Math.max(
              Number(details.durationSeconds) || 0,
              Number(details.measuredEngagementSeconds) || 0
            )
          )}
        </strong>
        .
      </p>
      {sections.length ? (
        <ul>
          {sections.map((section) => (
            <li key={section}>
              <span>Visited {display(section)}</span>
              <strong>
                {typeof sectionTime[section] === "number"
                  ? duration(sectionTime[section])
                  : "Viewed"}
              </strong>
            </li>
          ))}
        </ul>
      ) : null}
      {pages.length ? <p>Pages: {pages.map(display).join(" · ")}</p> : null}
    </div>
  );
}

export default function LogsWorkspace() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const load = useCallback(async () => {
    setState("loading");
    const params = new URLSearchParams({ type });
    if (from) params.set("from", new Date(`${from}T00:00:00`).toISOString());
    if (to) params.set("to", new Date(`${to}T23:59:59.999`).toISOString());
    try {
      const response = await fetch(`/api/v1/settings/logs?${params.toString()}`, {
        cache: "no-store"
      });
      if (!response.ok) throw new Error();
      const payload = (await response.json()) as { data?: { entries?: LogEntry[] } };
      setEntries(payload.data?.entries ?? []);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [from, to, type]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <main className="workspace-page settings-logs-page">
      <header className="workspace-heading">
        <p className="eyebrow">Settings / Logs</p>
        <h1>Workspace logs</h1>
        <p>
          Review successful actions, failures, system errors, AI runs, and grouped anonymous
          portfolio visits in one private timeline.
        </p>
      </header>
      <form
        className="settings-log-filters"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <label>
          Show
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value);
            }}
          >
            {filters.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
            }}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
            }}
          />
        </label>
        <button type="submit">Apply filters</button>
      </form>
      {state === "loading" ? <p>Loading logs…</p> : null}
      {state === "error" ? <p role="alert">Logs could not be loaded. Try again.</p> : null}
      {state === "ready" && !entries.length ? (
        <p className="analytics-empty">No entries match these filters.</p>
      ) : null}
      <ol className="settings-log-list">
        {entries.map((entry) => (
          <li key={entry.id}>
            <details className="settings-log-accordion">
              <summary>
                <span className={`settings-log-status is-${entry.status}`} aria-hidden="true" />
                <span>
                  <strong>{entry.title}</strong>
                  <small>
                    {formatTime(entry.occurredAt)} · {entry.source}
                  </small>
                  <small className="settings-log-summary">{entry.summary}</small>
                </span>
                <b>{display(entry.category)}</b>
              </summary>
              <div className="settings-log-body">
                <p>{entry.summary}</p>
                {entry.kind === "portfolio_visit" ? (
                  <PortfolioDetails details={entry.details} />
                ) : (
                  <dl>
                    {Object.entries(entry.details)
                      .filter(([, value]) => value !== null && value !== undefined)
                      .map(([key, value]) => (
                        <div key={key}>
                          <dt>{display(key)}</dt>
                          <dd>{detailValue(value)}</dd>
                        </div>
                      ))}
                  </dl>
                )}
              </div>
            </details>
          </li>
        ))}
      </ol>
    </main>
  );
}
