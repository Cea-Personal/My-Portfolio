import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runCodexOrchestrator } from "./codex-app-server";
import { aiRuntimeClient } from "./ai-runtime-client";

interface ProviderRow {
  id: string;
  provider: string;
  model: string;
  model_version: string;
  capabilities: string[];
  secret_ref: string | null;
}

interface CapabilityRow {
  provider_config_id: string;
  fallback_provider_config_id: string | null;
  creativity: number;
  length_limit: number;
  timeout_ms: number;
  retry_limit: number;
}

export interface ResolvedReasoningProvider extends ProviderRow {
  apiKey: string;
  endpoint: string;
  creativity: number;
  maxTokens: number;
  timeoutMs: number;
  retryLimit: number;
}

function endpointFor(provider: ProviderRow): string {
  if (provider.provider === "codex_app_server") {
    // Native mode starts the local `codex app-server --stdio` process; no URL
    // is required.
    return "codex://local";
  }
  const prefix = provider.provider.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const configured = process.env[`${prefix}_CHAT_COMPLETIONS_URL`]?.trim();
  if (configured) return configured;
  if (provider.provider === "openai") return "https://api.openai.com/v1/chat/completions";
  throw new Error(
    `AI_PROVIDER_ENDPOINT_MISSING:${provider.provider === "codex_app_server" ? "CODEX_APP_SERVER_URL" : `${prefix}_CHAT_COMPLETIONS_URL`}`
  );
}

export async function resolveReasoningProviders(
  client: SupabaseClient,
  ownerId: string,
  task: string
): Promise<ResolvedReasoningProvider[]> {
  const runtimeClient = aiRuntimeClient(client);
  // All reasoning work is delegated to the single owner-configured
  // orchestrator. The task-specific lookup is retained only as a migration
  // fallback for owners who have not saved an orchestrator configuration yet.
  const orchestratorResult = await runtimeClient
    .schema("app")
    .from("ai_capability_configs")
    .select(
      "provider_config_id,fallback_provider_config_id,creativity,length_limit,timeout_ms,retry_limit"
    )
    .eq("owner_id", ownerId)
    .eq("task_type", "orchestrator")
    .eq("enabled", true)
    .maybeSingle();
  if (orchestratorResult.error) throw orchestratorResult.error;
  let capability = orchestratorResult.data as CapabilityRow | null;
  const configuredTask = capability ? "orchestrator" : task;
  if (!capability) {
    const legacyResult = await runtimeClient
      .schema("app")
      .from("ai_capability_configs")
      .select(
        "provider_config_id,fallback_provider_config_id,creativity,length_limit,timeout_ms,retry_limit"
      )
      .eq("owner_id", ownerId)
      .eq("task_type", task)
      .eq("enabled", true)
      .maybeSingle();
    if (legacyResult.error) throw legacyResult.error;
    capability = legacyResult.data as CapabilityRow | null;
  }
  if (!capability) throw new Error(`AI_CAPABILITY_NOT_CONFIGURED:${task}`);
  const ids = [capability.provider_config_id, capability.fallback_provider_config_id].filter(
    (id): id is string => typeof id === "string"
  );
  const providerResult = await runtimeClient
    .schema("app")
    .from("ai_provider_configs")
    .select("id,provider,model,model_version,capabilities,secret_ref")
    .in("id", ids)
    .eq("enabled", true);
  if (providerResult.error) throw providerResult.error;
  const rows = providerResult.data as ProviderRow[];
  const providers = ids.flatMap((id) => {
    const row = rows.find((candidate) => candidate.id === id);
    const supportsTask = row?.capabilities.some(
      (name) =>
        name === "*" ||
        name === task ||
        name === "reasoning" ||
        (configuredTask === "orchestrator" && name !== "embeddings")
    );
    if (!row || !supportsTask) return [];
    const apiKey = row.secret_ref ? (process.env[row.secret_ref]?.trim() ?? "") : "";
    if (row.provider !== "codex_app_server") {
      if (!row.secret_ref) throw new Error("AI_PROVIDER_SECRET_REFERENCE_MISSING");
      if (!apiKey) throw new Error(`AI_PROVIDER_SECRET_MISSING:${row.secret_ref}`);
      if (/^secret:\/\//i.test(apiKey))
        throw new Error(`AI_PROVIDER_SECRET_UNRESOLVED:${row.secret_ref}`);
    }
    return [
      {
        ...row,
        apiKey,
        endpoint: endpointFor(row),
        creativity: capability.creativity,
        maxTokens: Math.min(Math.max(capability.length_limit, 512), 16_000),
        timeoutMs: capability.timeout_ms,
        retryLimit: capability.retry_limit
      }
    ];
  });
  if (!providers.length) throw new Error(`AI_PROVIDER_NOT_AVAILABLE:${task}`);
  return providers;
}

function parseJsonObject(content: string): Record<string, unknown> {
  const normalized = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let candidateStart = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let lastObject: Record<string, unknown> | undefined;
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"' && candidateStart >= 0) {
      inString = true;
      continue;
    }
    if (character === "{" && depth === 0) {
      candidateStart = index;
      depth = 1;
      continue;
    }
    if (candidateStart < 0) continue;
    if (character === "{") depth += 1;
    if (character !== "}") continue;
    depth -= 1;
    if (depth !== 0) continue;
    try {
      const parsed: unknown = JSON.parse(normalized.slice(candidateStart, index + 1));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        lastObject = parsed as Record<string, unknown>;
      }
    } catch {
      // Ignore an incomplete/prose brace and continue looking for a complete object.
    }
    candidateStart = -1;
  }
  if (!lastObject) throw new Error("AI_PROVIDER_RESPONSE_INVALID_JSON");
  return lastObject;
}

function isTimeoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /(?:timeout|timed\s*out|aborted)/i.test(message);
}

/** Defense in depth for providers that ignore the employer privacy instruction. */
export function anonymizeEmployerReferences(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(
      /\bthames[\s-]+water(?:\s+(?:plc|limited|ltd))?\b/gi,
      "a utilities organisation"
    );
  }
  if (Array.isArray(value)) return value.map((item) => anonymizeEmployerReferences(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, anonymizeEmployerReferences(item)])
    );
  }
  return value;
}

export async function generateReasoningJson(
  providers: ResolvedReasoningProvider[],
  system: string,
  input: Record<string, unknown>,
  options: { task?: string } = {}
): Promise<{
  output: Record<string, unknown>;
  provider: ResolvedReasoningProvider;
  inputHash: string;
  outputHash: string;
  elapsedMs: number;
}> {
  const inputText = JSON.stringify(input);
  const inputHash = createHash("sha256").update(inputText).digest("hex");
  let lastError: unknown;
  for (const provider of providers) {
    const started = performance.now();
    for (let attempt = 0; attempt <= provider.retryLimit; attempt += 1) {
      try {
        if (provider.provider === "codex_app_server") {
          const task = options.task ?? "writing_assistance";
          const generated = await runCodexOrchestrator(
            task,
            { system, input },
            { timeoutMs: provider.timeoutMs }
          );
          const output = anonymizeEmployerReferences(parseJsonObject(generated.text)) as Record<
            string,
            unknown
          >;
          return {
            output,
            provider: { ...provider, model: generated.model },
            inputHash,
            outputHash: createHash("sha256").update(JSON.stringify(output)).digest("hex"),
            elapsedMs: Math.round(performance.now() - started)
          };
        }
        // A Codex App Server gateway may own model routing. For that adapter,
        // `server-default` means the gateway chooses the model according to its
        // server-side policy; ordinary providers always receive their model.
        const routedModel =
          provider.provider === "codex_app_server"
            ? process.env.CODEX_APP_SERVER_MODEL?.trim() ||
              (provider.model === "server-default" ? undefined : provider.model)
            : provider.model;
        const response = await fetch(provider.endpoint, {
          method: "POST",
          headers: {
            authorization: `Bearer ${provider.apiKey}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            ...(routedModel ? { model: routedModel } : {}),
            temperature: provider.creativity,
            ...(provider.provider === "openai"
              ? { max_completion_tokens: provider.maxTokens }
              : { max_tokens: provider.maxTokens }),
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: system },
              { role: "user", content: inputText }
            ]
          }),
          signal: AbortSignal.timeout(provider.timeoutMs)
        });
        if (!response.ok) throw new Error(`AI_PROVIDER_HTTP_${String(response.status)}`);
        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = payload.choices?.[0]?.message?.content;
        if (!content) throw new Error("AI_PROVIDER_RESPONSE_INVALID");
        const output = anonymizeEmployerReferences(parseJsonObject(content)) as Record<
          string,
          unknown
        >;
        return {
          output,
          provider,
          inputHash,
          outputHash: createHash("sha256").update(JSON.stringify(output)).digest("hex"),
          elapsedMs: Math.round(performance.now() - started)
        };
      } catch (error) {
        lastError = error;
        // Retrying a bounded native-agent request after its deadline only
        // multiplies the outage (and can make the HTTP route time out before
        // a configured fallback provider is reached). Move directly to the
        // next provider on timeout; transient non-timeout failures retain the
        // configured retry behavior.
        if (isTimeoutError(error)) break;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("AI_PROVIDER_FAILED");
}
