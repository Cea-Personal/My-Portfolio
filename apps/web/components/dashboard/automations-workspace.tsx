"use client";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
interface Schedule {
  id: string;
  purpose: string;
  recurrence: string;
  cron_expression: string;
  timezone: string;
  enabled: boolean;
  next_run_at: string | null;
}
interface Run {
  id: string;
  workflow_name: string;
  status: string;
  retry_count: number;
  resumed_from_id: string | null;
  created_at: string;
  error_code: string | null;
}
interface DeadLetter {
  id: string;
  run_id: string | null;
  event_name: string;
  reason: string;
  created_at: string;
  resolved_at: string | null;
}
async function mutate(endpoint: string, body: unknown, method: "POST" | "PATCH" = "POST") {
  const response = await fetch(endpoint, {
    method,
    headers: {
      "content-type": "application/json",
      "idempotency-key": `${method}-${crypto.randomUUID()}`
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      data?: { code?: string; detail?: string };
    };
    throw new Error(payload.data?.detail ?? payload.data?.code ?? "Request failed");
  }
}
export function AutomationsWorkspace() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [deadLetters, setDeadLetters] = useState<DeadLetter[]>([]);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/v1/automations", { cache: "no-store" });
    if (!response.ok) throw new Error();
    const payload = (await response.json()) as {
      data?: { schedules?: Schedule[]; runs?: Run[]; deadLetters?: DeadLetter[] };
    };
    setSchedules(payload.data?.schedules ?? []);
    setRuns(payload.data?.runs ?? []);
    setDeadLetters(payload.data?.deadLetters ?? []);
  }, []);
  useEffect(() => {
    void load().catch(() => {
      setMessage("Automation history could not be loaded.");
    });
  }, [load]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await mutate("/api/v1/automations", {
        purpose: form.get("purpose"),
        cronExpression: form.get("cronExpression"),
        timezone: form.get("timezone")
      });
      event.currentTarget.reset();
      setMessage("Disabled schedule created. Review it before enabling.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create schedule");
    }
  }
  async function toggle(schedule: Schedule) {
    try {
      await mutate(`/api/v1/automations/${schedule.id}`, { enabled: !schedule.enabled }, "PATCH");
      setMessage(`Schedule ${schedule.enabled ? "disabled" : "enabled"}.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update schedule");
    }
  }
  async function control(run: Run, action: "cancel" | "retry") {
    try {
      await mutate(`/api/v1/automation-runs/${run.id}/${action}`, {});
      setMessage(
        action === "retry"
          ? "A linked resume run was dispatched."
          : "Cancellation requested and persisted."
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Run control failed");
    }
  }
  async function resolve(item: DeadLetter) {
    const note = window.prompt("Resolution note")?.trim();
    if (!note) return;
    try {
      await mutate(`/api/v1/automation-dead-letters/${item.id}/resolve`, { note });
      setMessage("Dead letter resolved with history retained.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Resolution failed");
    }
  }
  return (
    <main className="workspace-page">
      <header className="workspace-heading">
        <p className="eyebrow">Durable control plane</p>
        <h1>Automations</h1>
        <p>
          Bounded schedules, persisted run/step histories, cancellation, linked resumes, and dead
          letters.
        </p>
      </header>
      <form className="knowledge-entry-form" onSubmit={(event) => void create(event)}>
        <h2>Create a disabled schedule</h2>
        <label>
          Purpose
          <select name="purpose">
            <option value="job_search">Job search</option>
            <option value="drive_sync">Drive sync</option>
            <option value="analytics_aggregate">Analytics aggregate</option>
          </select>
        </label>
        <label>
          Cron schedule
          <input
            aria-describedby="cron-help"
            name="cronExpression"
            required
            defaultValue="0 9 * * *"
            placeholder="0 9 * * *"
          />
        </label>
        <p id="cron-help">
          Five fields: minute, hour, day, month, weekday. For example, <code>30 8 * * 1-5</code>
          runs at 08:30 every weekday in your selected timezone.
        </p>
        <label>
          IANA timezone
          <input name="timezone" required defaultValue="Africa/Kigali" />
        </label>
        <button type="submit">Create schedule</button>
      </form>
      <section>
        <h2>Schedules</h2>
        {schedules.length ? (
          <ul className="workspace-list">
            {schedules.map((schedule) => (
              <li key={schedule.id}>
                <strong>{schedule.purpose}</strong> · <code>{schedule.cron_expression}</code> ·{" "}
                {schedule.timezone} · {schedule.enabled ? "enabled" : "disabled"}
                {schedule.next_run_at
                  ? ` · next ${new Date(schedule.next_run_at).toLocaleString()}`
                  : " · next run not calculated"}
                <button type="button" onClick={() => void toggle(schedule)}>
                  {schedule.enabled ? "Disable" : "Enable"}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No schedules configured.</p>
        )}
      </section>
      <section>
        <h2>Run and resume history</h2>
        {runs.length ? (
          <table>
            <thead>
              <tr>
                <th>Workflow</th>
                <th>Status</th>
                <th>Recovery</th>
                <th>Controls</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <th scope="row">
                    <a href={`/automations/${run.id}`}>{run.workflow_name}</a>
                  </th>
                  <td>
                    {run.status}
                    {run.error_code ? ` · ${run.error_code}` : ""}
                  </td>
                  <td>
                    {run.resumed_from_id ? `Resume of ${run.resumed_from_id}` : "Original run"} ·
                    retry {run.retry_count}
                  </td>
                  <td>
                    {["pending", "running"].includes(run.status) ? (
                      <button type="button" onClick={() => void control(run, "cancel")}>
                        Cancel
                      </button>
                    ) : null}
                    {["failed", "partial", "cancelled"].includes(run.status) ? (
                      <button type="button" onClick={() => void control(run, "retry")}>
                        Resume
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No workflow runs recorded.</p>
        )}
      </section>
      <section>
        <h2>Dead letters</h2>
        {deadLetters.length ? (
          <ul className="workspace-list">
            {deadLetters.map((item) => (
              <li key={item.id}>
                <strong>{item.event_name}</strong> · {item.reason} ·{" "}
                {item.resolved_at ? "resolved" : "open"}
                {!item.resolved_at ? (
                  <button type="button" onClick={() => void resolve(item)}>
                    Resolve
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>No dead letters.</p>
        )}
      </section>
      {message ? <p role="status">{message}</p> : null}
    </main>
  );
}
