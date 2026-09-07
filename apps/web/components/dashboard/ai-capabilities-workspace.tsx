"use client";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { WorkspaceToast } from "@/components/ui/workspace-toast";
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
  fallback_provider_id?: string | null;
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
interface OrchestratorHealth {
  ok: boolean;
  status: "healthy" | "unhealthy";
  provider?: string;
  model?: string;
  elapsedMs?: number;
  output?: Record<string, unknown>;
  detail?: string;
  checkedAt: string;
}
interface EmbeddingHealth {
  ok: boolean;
  status: "healthy" | "unhealthy";
  provider?: string;
  model?: string;
  dimensions?: number;
  elapsedMs?: number;
  detail?: string;
  checkedAt: string;
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
async function remove(endpoint: string) {
  const response = await fetch(endpoint, {
    method: "DELETE",
    headers: { "idempotency-key": `delete-${crypto.randomUUID()}` }
  });
  const payload = (await response.json().catch(() => ({}))) as {
    data?: { code?: string; detail?: string };
  };
  if (!response.ok) throw new Error(payload.data?.detail ?? payload.data?.code ?? "Delete failed");
}
export function AiCapabilitiesWorkspace({ view = "agents" }: { view?: "agents" | "providers" }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [runs, setRuns] = useState<AiRun[]>([]);
  const [message, setMessage] = useState("");
  const [health, setHealth] = useState<OrchestratorHealth | null>(null);
  const [healthRunning, setHealthRunning] = useState(false);
  const [embeddingHealth, setEmbeddingHealth] = useState<EmbeddingHealth | null>(null);
  const [embeddingHealthRunning, setEmbeddingHealthRunning] = useState(false);
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
  async function updateProvider(event: FormEvent<HTMLFormElement>, providerId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await post(
        `/api/v1/settings/ai-providers/${providerId}`,
        {
          provider: form.get("provider"),
          model: form.get("model"),
          modelVersion: form.get("modelVersion"),
          secretRef: form.get("secretRef"),
          capabilities: formText(form.get("capabilities"))
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        },
        "PATCH"
      );
      setMessage("Provider configuration updated.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Provider update failed");
    }
  }
  async function deleteProvider(provider: Provider) {
    if (
      !window.confirm(
        `Delete ${provider.provider} · ${provider.model}? Any orchestrator or embedding configuration using it will also be removed.`
      )
    )
      return;
    try {
      await remove(`/api/v1/settings/ai-providers/${provider.id}`);
      setMessage("Provider removed. Historical AI-run records were preserved.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Provider removal failed");
    }
  }
  async function configure(event: FormEvent<HTMLFormElement>, task: "orchestrator" | "embedding") {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const numberValue = (name: string, fallback: number) => {
      const raw = form.get(name);
      if (raw === null || raw === "") return fallback;
      const value = Number(raw);
      return Number.isFinite(value) ? value : fallback;
    };
    try {
      await post(
        `/api/v1/settings/ai-capabilities/${task}`,
        {
          providerId: form.get("providerId"),
          fallbackProviderId: form.get("fallbackProviderId") || undefined,
          modelClass: form.get("modelClass") || "balanced",
          creativity: numberValue("creativity", 0.2),
          lengthLimit: numberValue("lengthLimit", 2000),
          timeoutMs: numberValue("timeoutMs", task === "orchestrator" ? 120000 : 30000),
          retryLimit: numberValue("retryLimit", 2),
          enabled: form.get("enabled") === "on"
        },
        "PATCH"
      );
      setMessage(`${task === "embedding" ? "Embedding" : "Orchestrator"} configuration saved.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Configuration failed");
    }
  }
  async function deleteOrchestrator() {
    if (
      !window.confirm(
        "Remove the active orchestrator configuration? AI reasoning will be unavailable until one is saved again."
      )
    )
      return;
    try {
      await remove("/api/v1/settings/ai-capabilities/orchestrator");
      setMessage("Orchestrator configuration removed.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Orchestrator deletion failed");
    }
  }
  async function testOrchestrator() {
    setHealthRunning(true);
    setHealth(null);
    try {
      const response = await fetch("/api/v1/settings/ai-capabilities/orchestrator/health", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `orchestrator-health-${crypto.randomUUID()}`
        },
        body: JSON.stringify({})
      });
      const payload = (await response.json().catch(() => ({}))) as {
        data?: OrchestratorHealth;
      };
      if (!payload.data) throw new Error("The health check returned no diagnostic.");
      setHealth(payload.data);
      setMessage(
        payload.data.ok
          ? "Orchestrator health check completed."
          : (payload.data.detail ?? "Orchestrator health check failed.")
      );
      await load();
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Orchestrator health check failed.";
      setHealth({
        ok: false,
        status: "unhealthy",
        detail,
        checkedAt: new Date().toISOString()
      });
      setMessage(detail);
    } finally {
      setHealthRunning(false);
    }
  }
  async function testEmbedding() {
    setEmbeddingHealthRunning(true);
    setEmbeddingHealth(null);
    try {
      const response = await fetch("/api/v1/settings/ai-capabilities/embedding/health", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `embedding-health-${crypto.randomUUID()}`
        },
        body: JSON.stringify({})
      });
      const payload = (await response.json().catch(() => ({}))) as { data?: EmbeddingHealth };
      if (!payload.data) throw new Error("The embedding health check returned no diagnostic.");
      setEmbeddingHealth(payload.data);
      setMessage(
        payload.data.ok
          ? "Embedding health check completed."
          : (payload.data.detail ?? "Embedding health check failed.")
      );
      await load();
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Embedding health check failed.";
      setEmbeddingHealth({
        ok: false,
        status: "unhealthy",
        detail,
        checkedAt: new Date().toISOString()
      });
      setMessage(detail);
    } finally {
      setEmbeddingHealthRunning(false);
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
            <input name="model" required placeholder="text-embedding-3-small or server-default" />
          </label>
          <label>
            Model version (optional)
            <input
              name="modelVersion"
              placeholder="Leave blank if the provider does not publish one"
            />
          </label>
          <label>
            Server secret environment variable
            <input
              name="secretRef"
              pattern="[A-Z][A-Z0-9_]{2,80}"
              placeholder="OPENAI_API_KEY (leave blank for local Codex App Server)"
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
            the corresponding OpenAI-compatible request shape. For the native Codex App Server
            adapter, use provider <code>codex_app_server</code>, model <code>server-default</code>,
            and leave the secret reference blank. The server runs{" "}
            <code>codex app-server --stdio</code>
            using the configured Codex login. Native roles are loaded from the repository&apos;s{" "}
            <code>.codex/agents</code> directory. Set <code>CODEX_APP_SERVER_COMMAND</code> or{" "}
            <code>CODEX_PROJECT_ROOT</code> only when using a custom installation or launch
            directory.
          </p>
          {providers.length ? (
            <ul className="workspace-list">
              {providers.map((provider) => (
                <li key={provider.id}>
                  <strong>
                    {provider.provider} · {provider.model}
                  </strong>
                  <p>
                    {provider.model_version === "unversioned"
                      ? "No published version"
                      : `Version ${provider.model_version}`}{" "}
                    · {provider.capabilities.join(", ")}
                  </p>
                  <details>
                    <summary>Edit provider</summary>
                    <form
                      className="knowledge-entry-form"
                      onSubmit={(event) => void updateProvider(event, provider.id)}
                    >
                      <label>
                        Provider identifier
                        <input name="provider" required defaultValue={provider.provider} />
                      </label>
                      <label>
                        Model
                        <input name="model" required defaultValue={provider.model} />
                      </label>
                      <label>
                        Model version (optional)
                        <input
                          name="modelVersion"
                          defaultValue={
                            provider.model_version === "unversioned"
                              ? ""
                              : provider.model_version
                          }
                        />
                      </label>
                      <label>
                        Server secret environment variable
                        <input
                          name="secretRef"
                          pattern="[A-Z][A-Z0-9_]{2,80}"
                          placeholder="Leave blank to retain the current reference"
                        />
                      </label>
                      <label>
                        Supported capabilities
                        <input
                          name="capabilities"
                          required
                          defaultValue={provider.capabilities.join(", ")}
                        />
                      </label>
                      <div className="workspace-actions">
                        <button type="submit">Save provider</button>
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() => void deleteProvider(provider)}
                        >
                          Delete provider
                        </button>
                      </div>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
          ) : (
            <p>No provider has been registered.</p>
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
  return (
    <main className="workspace-page">
      <header className="workspace-heading">
        <p className="eyebrow">Task orchestration</p>
        <h1>Agents</h1>
        <p>
          One orchestrator coordinates every bounded reasoning subagent. Native Codex roles keep
          focused instructions and can override the orchestrator model in <code>.codex/agents</code>
          .
        </p>
      </header>
      {(() => {
        const orchestrator = capabilities.find(
          (capability) => capability.task_type === "orchestrator"
        );
        const formKey = orchestrator
          ? [
              orchestrator.provider_id,
              orchestrator.fallback_provider_id,
              orchestrator.enabled,
              orchestrator.creativity,
              orchestrator.length_limit,
              orchestrator.timeout_ms,
              orchestrator.retry_limit
            ]
              .map(String)
              .join("-")
          : "new-orchestrator";
        return (
          <form
            key={formKey}
            className="knowledge-entry-form"
            onSubmit={(event) => void configure(event, "orchestrator")}
          >
            <h2>{orchestrator ? "Edit orchestrator" : "Configure the orchestrator"}</h2>
            <p>
              Choose the parent orchestrator model. Native Codex role files may override this model
              per agent; embeddings remain a separate retrieval model configured below.
            </p>
            <label>
              Orchestrator provider
              <select name="providerId" required defaultValue={orchestrator?.provider_id ?? ""}>
                <option value="">Select provider</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.provider} · {provider.model}
                  </option>
                ))}
              </select>
            </label>
            <label>
              OpenAI live-search fallback (optional)
              <select
                name="fallbackProviderId"
                defaultValue={orchestrator?.fallback_provider_id ?? ""}
              >
                <option value="">No fallback</option>
                {providers
                  .filter(
                    (provider) =>
                      provider.provider === "openai" &&
                      provider.capabilities.some(
                        (capability) => capability === "*" || capability === "reasoning"
                      )
                  )
                  .map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.provider} · {provider.model}
                    </option>
                  ))}
              </select>
              <small>
                Live web discovery uses OpenAI&apos;s Responses web_search tool. Codex remains the
                primary orchestrator for all other tasks.
              </small>
            </label>
            <label>
              Model class
              <select name="modelClass" defaultValue={orchestrator?.model_class ?? "balanced"}>
                <option value="fast">fast</option>
                <option value="balanced">balanced</option>
                <option value="deep">deep</option>
              </select>
            </label>
            <label>
              Creativity
              <input
                name="creativity"
                type="number"
                min="0"
                max="1"
                step="0.05"
                defaultValue={orchestrator?.creativity ?? 0.2}
              />
            </label>
            <label>
              Length limit
              <input
                name="lengthLimit"
                type="number"
                min="128"
                max="32000"
                defaultValue={orchestrator?.length_limit ?? 2000}
              />
            </label>
            <label>
              Timeout ms
              <input
                name="timeoutMs"
                type="number"
                min="1000"
                max="120000"
                defaultValue={orchestrator?.timeout_ms ?? 120000}
              />
            </label>
            <label>
              Retries
              <input
                name="retryLimit"
                type="number"
                min="0"
                max="5"
                defaultValue={orchestrator?.retry_limit ?? 2}
              />
            </label>
            <label>
              <input
                name="enabled"
                type="checkbox"
                defaultChecked={orchestrator?.enabled ?? false}
              />{" "}
              Enable after validation
            </label>
            <div className="workspace-actions">
              <button type="submit" disabled={!providers.length}>
                {orchestrator ? "Save changes" : "Save orchestrator"}
              </button>
              {orchestrator ? (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => void deleteOrchestrator()}
                >
                  Delete orchestrator
                </button>
              ) : null}
            </div>
          </form>
        );
      })()}
      <section className="ai-health-panel" aria-live="polite">
        <div className="workspace-section-heading">
          <div>
            <p className="eyebrow">Runtime verification</p>
            <h2>Test orchestrator health</h2>
          </div>
          <button
            type="button"
            className="button-secondary"
            disabled={
              healthRunning ||
              !capabilities.some((item) => item.task_type === "orchestrator" && item.enabled)
            }
            onClick={() => void testOrchestrator()}
          >
            {healthRunning ? "Running check…" : "Run health check"}
          </button>
        </div>
        <p>
          Sends a minimal diagnostic through the configured orchestrator and its native child agent.
          It does not use your career evidence or create an application.
        </p>
        {!capabilities.some((item) => item.task_type === "orchestrator" && item.enabled) ? (
          <p role="note">Enable an orchestrator configuration above before testing it.</p>
        ) : null}
        {health ? (
          <div className={`ai-health-result ${health.ok ? "is-healthy" : "is-unhealthy"}`}>
            <strong>{health.ok ? "Healthy" : "Unhealthy"}</strong>
            <span>
              {health.provider
                ? `${health.provider} · ${health.model ?? "server-selected model"}`
                : health.detail}
              {typeof health.elapsedMs === "number" ? ` · ${String(health.elapsedMs)}ms` : ""}
            </span>
            {health.output ? <pre>{JSON.stringify(health.output, null, 2)}</pre> : null}
            <small>Checked {new Date(health.checkedAt).toLocaleString()}</small>
          </div>
        ) : null}
      </section>
      {(() => {
        const embedding = capabilities.find((capability) => capability.task_type === "embedding");
        const embeddingProviders = providers.filter((provider) =>
          provider.capabilities.some(
            (capability) => capability === "*" || /^(embedding|embeddings)$/i.test(capability)
          )
        );
        return (
          <div>
            <form
              key={`embedding-${embedding?.provider_id ?? "new"}-${String(embedding?.enabled ?? false)}`}
              className="knowledge-entry-form"
              onSubmit={(event) => void configure(event, "embedding")}
            >
              <h2>{embedding ? "Edit embeddings" : "Configure embeddings"}</h2>
              <p>
                Career Brain and document indexing need an enabled embedding capability. The
                provider credential stays server-side; for OpenAI, set <code>OPENAI_API_KEY</code>{" "}
                in the web server environment.
              </p>
              <label>
                Embedding provider
                <select name="providerId" required defaultValue={embedding?.provider_id ?? ""}>
                  <option value="">Select provider</option>
                  {embeddingProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.provider} · {provider.model}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <input
                  name="enabled"
                  type="checkbox"
                  defaultChecked={embedding?.enabled ?? false}
                />{" "}
                Enable embeddings
              </label>
              <div className="workspace-actions">
                <button type="submit" disabled={!embeddingProviders.length}>
                  {embedding ? "Save embedding changes" : "Enable embeddings"}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={!embedding?.enabled || embeddingHealthRunning}
                  onClick={() => void testEmbedding()}
                >
                  {embeddingHealthRunning ? "Testing…" : "Test embedding connection"}
                </button>
              </div>
              {!embeddingProviders.length ? (
                <p role="note">
                  Register a provider with capability <code>embeddings</code> above first.
                </p>
              ) : null}
            </form>
            {embeddingHealth ? (
              <div
                className={`ai-health-result ${embeddingHealth.ok ? "is-healthy" : "is-unhealthy"}`}
                aria-live="polite"
              >
                <strong>{embeddingHealth.ok ? "Healthy" : "Unhealthy"}</strong>
                <span>
                  {embeddingHealth.provider
                    ? `${embeddingHealth.provider} · ${embeddingHealth.model ?? "server-selected model"} · ${String(embeddingHealth.dimensions ?? 0)} dimensions`
                    : embeddingHealth.detail}
                  {typeof embeddingHealth.elapsedMs === "number"
                    ? ` · ${String(embeddingHealth.elapsedMs)}ms`
                    : ""}
                </span>
                <small>Checked {new Date(embeddingHealth.checkedAt).toLocaleString()}</small>
              </div>
            ) : null}
          </div>
        );
      })()}
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
      <WorkspaceToast
        message={message}
        onDismiss={() => {
          setMessage("");
        }}
      />
    </main>
  );
}
