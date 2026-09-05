"use client";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
const subagents = [
  ["Portfolio assistant", "public_qa"],
  ["Role-fit analyst", "role_fit"],
  ["Career synthesizer", "evidence_extraction"],
  ["Career gap analyst", "career_gap"],
  ["Job matcher", "job_scoring"],
  ["Application writer", "document_composition"],
  ["Compensation analyst", "compensation"],
  ["Interview coach", "interview_preparation"],
  ["Writing editor", "writing_assistance"]
] as const;
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
      "idempotency-key": `${method.toLowerCase()}-${crypto.randomUUID()}`,
      ...(method === "PATCH" ? { "if-match": "*" } : {})
    },
    body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => ({}))) as {
    data?: { code?: string; detail?: string };
  };
  if (!response.ok) throw new Error(payload.data?.detail ?? payload.data?.code ?? "Request failed");
}
export function AiCapabilitiesWorkspace({ view = "agents" }: { view?: "agents" | "providers" }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [runs, setRuns] = useState<AiRun[]>([]);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/v1/settings/ai-capabilities", { cache: "no-store" });
    if (!response.ok) throw new Error();
    const payload = (await response.json()) as {
      data?: { providers?: Provider[]; capabilities?: Capability[] };
    };
    setProviders(payload.data?.providers ?? []);
    setCapabilities(payload.data?.capabilities ?? []);
    if (view === "agents") {
      const runResponse = await fetch("/api/v1/ai-runs", { cache: "no-store" });
      if (!runResponse.ok) throw new Error();
      const runPayload = (await runResponse.json()) as { data?: { runs?: AiRun[] } };
      setRuns(runPayload.data?.runs ?? []);
    }
  }, [view]);
  useEffect(() => {
    void load().catch(() => {
      setMessage("AI configuration could not be loaded.");
    });
  }, [load]);
  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    const form = new FormData(target);
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
      target.reset();
      setMessage("Provider reference registered. No secret value was stored or returned.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Provider registration failed");
    }
  }
  async function configure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const task = "orchestrator";
    try {
      await post(
        `/api/v1/settings/ai-capabilities/${task}`,
        {
          providerId: form.get("providerId"),
          fallbackProviderId: undefined,
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
  if (view === "providers") {
    return (
      <main className="workspace-page">
        <header className="workspace-heading">
          <p className="eyebrow">Model connections</p>
          <h1>AI providers</h1>
          <p>
            Register model endpoints and environment-variable references. Provider settings define
            where inference runs; they do not decide which agent task uses a model.
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
            <input name="model" required placeholder="text-embedding-3-small" />
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
            <input name="capabilities" required defaultValue="embeddings" />
          </label>
          <button type="submit">Register reference</button>
        </form>
        <section>
          <h2>Registered providers</h2>
          <p>
            For non-OpenAI providers, set a server variable named like
            <code> PROVIDER_EMBEDDINGS_URL</code> for embeddings and
            <code> PROVIDER_CHAT_COMPLETIONS_URL</code> for reasoning tasks. Endpoints must accept
            the corresponding OpenAI-compatible request shape.
          </p>
          {providers.length ? (
            <ul className="workspace-list">
              {providers.map((provider) => (
                <li key={provider.id}>
                  <strong>
                    {provider.provider} · {provider.model}
                  </strong>
                  <p>
                    Version {provider.model_version} · {provider.capabilities.join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p>No provider has been registered.</p>
          )}
        </section>
        {message ? <p role="status">{message}</p> : null}
      </main>
    );
  }
  return (
    <main className="workspace-page">
      <header className="workspace-heading">
        <p className="eyebrow">Task orchestration</p>
        <h1>Agents</h1>
        <p>
          One orchestrator model coordinates every bounded reasoning subagent. Agents are focused
          roles with their own instructions and tools; they never select independent models.
        </p>
      </header>
      <form className="knowledge-entry-form" onSubmit={(event) => void configure(event)}>
        <h2>Configure the orchestrator</h2>
        <p>
          Choose the one reasoning model used by all subagents. Embeddings remain a separate
          retrieval model and are configured under AI providers.
        </p>
        <label>
          Orchestrator provider
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
          Save orchestrator
        </button>
      </form>
      <section>
        <h2>Subagents</h2>
        <p>
          Each role below is a subagent running under the same orchestrator model. Role prompts,
          permissions, and output schemas stay independent even though model selection is shared.
        </p>
        <ul className="workspace-list">
          {subagents.map(([label, task]) => (
            <li key={task}>
              <strong>{label}</strong>
              <p>{task} · delegated to the orchestrator</p>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Active orchestrator configuration</h2>
        {capabilities.filter((capability) => capability.task_type === "orchestrator").length ? (
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
              {capabilities
                .filter((capability) => capability.task_type === "orchestrator")
                .map((capability) => (
                  <tr key={capability.task_type}>
                    <th scope="row">single_model_orchestrator</th>
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
          <p>No orchestrator has been configured yet. Save one above before running agents.</p>
        )}
      </section>
      {capabilities.some((capability) => capability.task_type !== "orchestrator") ? (
        <p role="note">
          Older task-specific configurations still exist for migration visibility. They are ignored
          once the orchestrator is enabled and can be removed after verification.
        </p>
      ) : null}
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
