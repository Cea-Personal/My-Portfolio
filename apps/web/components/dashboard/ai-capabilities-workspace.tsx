"use client";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
const tasks = [
  "public_qa",
  "role_fit",
  "evidence_extraction",
  "career_gap",
  "job_scoring",
  "document_composition",
  "compensation",
  "interview_preparation",
  "writing_assistance"
];
interface Provider {
  id: string;
  provider: string;
  model: string;
  model_version: string;
  capabilities: string[];
}
interface Capability {
  task_type: string;
  provider_id: string;
  provider: string;
  model: string;
  model_class: string;
  creativity: number;
  length_limit: number;
  timeout_ms: number;
  retry_limit: number;
  enabled: boolean;
  health_status: string;
  consecutive_failures: number;
  circuit_open_until: string | null;
  last_error_code: string | null;
}
interface AiRun {
  id: string;
  task: string;
  status: string;
  instruction_version: string | null;
  usage: Record<string, number>;
  elapsed_ms: number | null;
  error_code: string | null;
  sanitized_error: string | null;
  created_at: string;
}
const formText = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");
async function post(endpoint: string, body: unknown, method: "POST" | "PATCH" = "POST") {
  const response = await fetch(endpoint, {
    method,
    headers: {
      "content-type": "application/json",
      "idempotency-key": `${method.toLowerCase()}-${crypto.randomUUID()}`
    },
    body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => ({}))) as {
    data?: { code?: string; detail?: string };
  };
  if (!response.ok) throw new Error(payload.data?.detail ?? payload.data?.code ?? "Request failed");
}
export function AiCapabilitiesWorkspace() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [runs, setRuns] = useState<AiRun[]>([]);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const [response, runResponse] = await Promise.all([
      fetch("/api/v1/settings/ai-capabilities", { cache: "no-store" }),
      fetch("/api/v1/ai-runs", { cache: "no-store" })
    ]);
    if (!response.ok || !runResponse.ok) throw new Error();
    const payload = (await response.json()) as {
      data?: { providers?: Provider[]; capabilities?: Capability[] };
    };
    const runPayload = (await runResponse.json()) as { data?: { runs?: AiRun[] } };
    setProviders(payload.data?.providers ?? []);
    setCapabilities(payload.data?.capabilities ?? []);
    setRuns(runPayload.data?.runs ?? []);
  }, []);
  useEffect(() => {
    void load().catch(() => {
      setMessage("AI configuration could not be loaded.");
    });
  }, [load]);
  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await post("/api/v1/settings/ai-providers", {
        provider: form.get("provider"),
        model: form.get("model"),
        modelVersion: form.get("modelVersion"),
        secretRef: form.get("secretRef"),
        capabilities: formText(form.get("capabilities"))
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      });
      event.currentTarget.reset();
      setMessage("Provider reference registered. No secret value was stored or returned.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Provider registration failed");
    }
  }
  async function configure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const task = formText(form.get("task"));
    try {
      await post(
        `/api/v1/settings/ai-capabilities/${task}`,
        {
          providerId: form.get("providerId"),
          fallbackProviderId: form.get("fallbackProviderId") || undefined,
          modelClass: form.get("modelClass"),
          creativity: Number(form.get("creativity")),
          lengthLimit: Number(form.get("lengthLimit")),
          timeoutMs: Number(form.get("timeoutMs")),
          retryLimit: Number(form.get("retryLimit")),
          enabled: form.get("enabled") === "on"
        },
        "PATCH"
      );
      setMessage(`${task} configuration saved.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Configuration failed");
    }
  }
  return (
    <main className="workspace-page">
      <header className="workspace-heading">
        <p className="eyebrow">Bounded AI controls</p>
        <h1>Agents & providers</h1>
        <p>
          Choose provider behavior per capability. Secret values stay in server environment
          variables; only references are stored.
        </p>
      </header>
      <form className="knowledge-entry-form" onSubmit={(event) => void register(event)}>
        <h2>Register an available provider</h2>
        <label>
          Provider identifier
          <input name="provider" required placeholder="openai" />
        </label>
        <label>
          Model
          <input name="model" required />
        </label>
        <label>
          Model version
          <input name="modelVersion" required />
        </label>
        <label>
          Server secret environment variable
          <input
            name="secretRef"
            required
            pattern="[A-Z][A-Z0-9_]{2,80}"
            placeholder="OPENAI_API_KEY"
          />
        </label>
        <label>
          Supported capabilities
          <input name="capabilities" required defaultValue={tasks.join(",")} />
        </label>
        <button type="submit">Register reference</button>
      </form>
      <form className="knowledge-entry-form" onSubmit={(event) => void configure(event)}>
        <h2>Configure a capability</h2>
        <label>
          Task
          <select name="task">
            {tasks.map((task) => (
              <option key={task}>{task}</option>
            ))}
          </select>
        </label>
        <label>
          Primary provider
          <select name="providerId" required>
            <option value="">Select provider</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.provider} · {provider.model}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fallback provider
          <select name="fallbackProviderId">
            <option value="">No fallback</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.provider} · {provider.model}
              </option>
            ))}
          </select>
        </label>
        <label>
          Model class
          <select name="modelClass">
            <option>fast</option>
            <option defaultValue="balanced">balanced</option>
            <option>deep</option>
          </select>
        </label>
        <label>
          Creativity
          <input name="creativity" type="number" min="0" max="1" step="0.05" defaultValue="0.2" />
        </label>
        <label>
          Length limit
          <input name="lengthLimit" type="number" min="128" max="32000" defaultValue="2000" />
        </label>
        <label>
          Timeout ms
          <input name="timeoutMs" type="number" min="1000" max="120000" defaultValue="30000" />
        </label>
        <label>
          Retries
          <input name="retryLimit" type="number" min="0" max="5" defaultValue="2" />
        </label>
        <label>
          <input name="enabled" type="checkbox" /> Enable after validation
        </label>
        <button type="submit" disabled={!providers.length}>
          Save capability
        </button>
      </form>
      <section>
        <h2>Active configuration and circuit state</h2>
        {capabilities.length ? (
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Provider</th>
                <th>Controls</th>
                <th>Health</th>
              </tr>
            </thead>
            <tbody>
              {capabilities.map((capability) => (
                <tr key={capability.task_type}>
                  <th scope="row">{capability.task_type}</th>
                  <td>
                    {capability.provider} · {capability.model}
                  </td>
                  <td>
                    {capability.model_class}; creativity {capability.creativity}; max{" "}
                    {capability.length_limit}; timeout {capability.timeout_ms}ms; retries{" "}
                    {capability.retry_limit}; {capability.enabled ? "enabled" : "disabled"}
                  </td>
                  <td>
                    {capability.health_status}; {capability.consecutive_failures} consecutive
                    failures
                    {capability.circuit_open_until
                      ? `; circuit open until ${capability.circuit_open_until}`
                      : ""}
                    {capability.last_error_code ? `; ${capability.last_error_code}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No capability has been configured yet.</p>
        )}
      </section>
      <section>
        <h2>Sanitized execution diagnostics</h2>
        <p>Inputs, outputs, prompts, secret references, and credentials are never included here.</p>
        {runs.length ? (
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Status</th>
                <th>Instruction</th>
                <th>Usage / elapsed</th>
                <th>Safe error</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <th scope="row">{run.task}</th>
                  <td>{run.status}</td>
                  <td>{run.instruction_version ?? "not recorded"}</td>
                  <td>
                    {JSON.stringify(run.usage)} ·{" "}
                    {run.elapsed_ms === null ? "pending" : `${String(run.elapsed_ms)}ms`}
                  </td>
                  <td>{run.error_code ?? run.sanitized_error ?? "none"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No AI execution has been recorded.</p>
        )}
      </section>
      {message ? <p role="status">{message}</p> : null}
    </main>
  );
}
