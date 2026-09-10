import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aiRuntimeClient } from "./ai-runtime-client";

interface ProviderHealthCheck {
  ownerId: string;
  providerConfigId?: string;
  task: "orchestrator_health" | "embedding_health" | "reranker_health";
  status: "completed" | "failed";
  elapsedMs: number;
  inputHash?: string;
  outputHash?: string;
  error?: string;
}

export function diagnosticHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function recordProviderHealthCheck(
  fallbackClient: SupabaseClient,
  check: ProviderHealthCheck
): Promise<void> {
  const client = aiRuntimeClient(fallbackClient);
  const checkedAt = new Date().toISOString();
  const errorCode = check.error?.split(":", 1)[0]?.slice(0, 120) ?? null;

  if (check.providerConfigId) {
    const previous = await client
      .schema("app")
      .from("ai_provider_health")
      .select("consecutive_failures")
      .eq("provider_config_id", check.providerConfigId)
      .maybeSingle();
    if (previous.error) throw previous.error;
    const health = await client
      .schema("app")
      .from("ai_provider_health")
      .upsert(
        {
          provider_config_id: check.providerConfigId,
          status: check.status === "completed" ? "healthy" : "down",
          consecutive_failures:
            check.status === "completed" ? 0 : Number(previous.data?.consecutive_failures ?? 0) + 1,
          circuit_open_until: null,
          last_error_code: errorCode,
          checked_at: checkedAt
        },
        { onConflict: "provider_config_id" }
      );
    if (health.error) throw health.error;
  }

  const run = await client
    .schema("app")
    .from("ai_runs")
    .insert({
      owner_id: check.ownerId,
      task: check.task,
      provider_config_id: check.providerConfigId ?? null,
      status: check.status,
      input_hash: check.inputHash ?? null,
      output_hash: check.outputHash ?? null,
      instruction_version: `${check.task}.v1`,
      usage: {},
      elapsed_ms: check.elapsedMs,
      error_code: errorCode,
      sanitized_error: check.error?.slice(0, 500) ?? null,
      related_type: "ai_provider",
      related_id: check.providerConfigId ?? null,
      finished_at: checkedAt
    });
  if (run.error) throw run.error;
}
