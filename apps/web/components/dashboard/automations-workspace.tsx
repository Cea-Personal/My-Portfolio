"use client";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { WorkspaceToast } from "@/components/ui/workspace-toast";
interface Schedule {
  id: string;
  purpose: string;
  recurrence: string;
  cron_expression: string;
  timezone: string;
  enabled: boolean;
  next_run_at: string | null;
  profile_id: string | null;
}
interface SearchProfile { id: string; name: string; }
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
async function mutate(
  endpoint: string,
  body: unknown,
  method: "POST" | "PATCH" | "DELETE" = "POST"
) {
  const response = await fetch(endpoint, {
    method,
    headers: {
      "content-type": "application/json",
      "idempotency-key": `${method}-${crypto.randomUUID()}`,
      ...(method === "PATCH" ? { "if-match": "*" } : {})
    },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
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
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const [response, profilesResponse] = await Promise.all([
      fetch("/api/v1/automations", { cache: "no-store" }),
      fetch("/api/v1/search-profiles", { cache: "no-store" })
    ]);
    if (!response.ok || !profilesResponse.ok) throw new Error();
    const payload = (await response.json()) as {
      data?: { schedules?: Schedule[]; runs?: Run[]; deadLetters?: DeadLetter[] };
    };
    const profilesPayload = (await profilesResponse.json()) as { data?: { profiles?: SearchProfile[] } };
    setSchedules(payload.data?.schedules ?? []);
    setRuns(payload.data?.runs ?? []);
    setDeadLetters(payload.data?.deadLetters ?? []);
    setProfiles(profilesPayload.data?.profiles ?? []);
  }, []);
  useEffect(() => {
    void load().catch(() => {
      setMessage("Automation history could not be loaded.");
    });
  }, [load]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // React clears the synthetic event's currentTarget after the async request;
    // keep the concrete form node before awaiting so reset() is reliable.
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await mutate("/api/v1/automations", {
        purpose: form.get("purpose"),
        profileId: form.get("profileId") || undefined,
        cronExpression: form.get("cronExpression"),
        timezone: form.get("timezone")
      });
      formElement.reset();
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
  async function edit(event: FormEvent<HTMLFormElement>, schedule: Schedule) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await mutate(
        `/api/v1/automations/${schedule.id}`,
        {
          cronExpression: form.get("cronExpression"),
          timezone: form.get("timezone"),
          ...(schedule.purpose === "job_search" ? { profileId: form.get("profileId") } : {})
        },
        "PATCH"
      );
      setMessage("Automation schedule updated.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update automation");
    }
  }
  async function remove(schedule: Schedule) {
    if (!window.confirm(`Delete the ${schedule.purpose} automation? This cannot be undone.`)) return;
    try {
      await mutate(`/api/v1/automations/${schedule.id}`, undefined, "DELETE");
      setMessage("Automation deleted.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete automation");
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
    <main className="workspace-page automations-page">
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
            <option value="career_brain">Career Brain synthesis</option>
            <option value="analytics_aggregate">Analytics aggregate</option>
          </select>
        </label>
        <label>
          Search profile
          <select name="profileId" defaultValue="">
            <option value="">Select a profile (required for job search)</option>
            {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
          </select>
        </label>
        <label>
          Cron schedule
          <input
            aria-describedby="cron-help"
            name="cronExpression"
            required
            defaultValue="30 8 * * 1-5"
            placeholder="30 8 * * 1-5"
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
                <button type="button" onClick={() => void remove(schedule)}>
                  Delete
                </button>
                <details>
                  <summary>Edit schedule</summary>
                  <form
                    className="knowledge-entry-form"
                    onSubmit={(event) => {
                      void edit(event, schedule);
                    }}
                  >
                    {schedule.purpose === "job_search" ? (
                      <label>
                        Search profile
                        <select name="profileId" defaultValue={schedule.profile_id ?? ""} required>
                          {profiles.map((profile) => (
                            <option key={profile.id} value={profile.id}>{profile.name}</option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <label>
                      Cron schedule
                      <input name="cronExpression" defaultValue={schedule.cron_expression} required />
                    </label>
                    <label>
                      IANA timezone
                      <input name="timezone" defaultValue={schedule.timezone} required />
                    </label>
                    <button type="submit">Save schedule</button>
                  </form>
                </details>
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
      <WorkspaceToast
        message={message}
        onDismiss={() => {
          setMessage("");
        }}
      />
    </main>
  );
}
