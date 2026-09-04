import { createServiceSupabaseClient } from "@career-os/database/service";
import type { SupabaseClient } from "@supabase/supabase-js";
export function workflowClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createServiceSupabaseClient(url, key) : null;
}
export async function beginRun(
  client: SupabaseClient,
  event: { id?: string; name: string; data: Record<string, unknown> }
) {
  const ownerId = typeof event.data.ownerId === "string" ? event.data.ownerId : "";
  const operationKey = typeof event.data.operationKey === "string" ? event.data.operationKey : "";
  if (!ownerId || !operationKey) throw new Error("INVALID_EVENT_ENVELOPE");
  const authorized = await client
    .schema("app")
    .from("owner_authorizations")
    .select("user_id")
    .eq("user_id", ownerId)
    .eq("active", true)
    .maybeSingle();
  if (authorized.error || !authorized.data)
    throw authorized.error ?? new Error("OWNER_AUTHORIZATION_REQUIRED");
  const prior = await client
    .schema("app")
    .from("automation_runs")
    .select("id,status")
    .eq("owner_id", ownerId)
    .eq("idempotency_key", operationKey.slice(0, 128))
    .maybeSingle();
  if (prior.error) throw prior.error;
  if (prior.data && ["completed", "cancelled"].includes(prior.data.status))
    return {
      id: prior.data.id as string,
      ownerId,
      cancelled: prior.data.status === "cancelled",
      alreadyComplete: prior.data.status === "completed"
    };
  const result = await client
    .schema("app")
    .from("automation_runs")
    .upsert(
      {
        owner_id: ownerId,
        workflow_name: event.name,
        workflow_version: 1,
        status: "running",
        correlation_id:
          typeof event.data.correlationId === "string"
            ? event.data.correlationId
            : (event.id ?? crypto.randomUUID()),
        idempotency_key: operationKey.slice(0, 128),
        started_at: new Date().toISOString(),
        last_heartbeat_at: new Date().toISOString(),
        context_metadata: {
          resourceType: event.data.resourceType ?? null,
          resourceId: event.data.resourceId ?? null
        }
      },
      { onConflict: "owner_id,idempotency_key", ignoreDuplicates: false }
    )
    .select("id,status")
    .single();
  if (result.error || !result.data) throw result.error ?? new Error("WORKFLOW_RUN_CREATE_FAILED");
  return { id: result.data.id as string, ownerId, cancelled: false, alreadyComplete: false };
}
export async function recordStep(
  client: SupabaseClient,
  runId: string,
  operationKey: string,
  stepName: string,
  status: string,
  errorCode?: string
) {
  const existing = await client
    .schema("app")
    .from("automation_run_steps")
    .select("attempt_count")
    .eq("run_id", runId)
    .eq("operation_key", operationKey.slice(0, 180))
    .maybeSingle();
  if (existing.error) throw existing.error;
  const result = await client
    .schema("app")
    .from("automation_run_steps")
    .upsert(
      {
        run_id: runId,
        step_name: stepName,
        step_version: 1,
        operation_key: operationKey.slice(0, 180),
        status,
        attempt_count: Number(existing.data?.attempt_count ?? 0) + 1,
        started_at: new Date().toISOString(),
        finished_at: ["completed", "failed", "cancelled", "partial"].includes(status)
          ? new Date().toISOString()
          : null,
        error_code: errorCode?.slice(0, 120) ?? null,
        input_refs: [],
        output_refs: []
      },
      { onConflict: "run_id,operation_key" }
    );
  if (result.error) throw result.error;
}
export async function finishRun(
  client: SupabaseClient,
  runId: string,
  status: "completed" | "partial" | "failed" | "cancelled",
  errorCode?: string
) {
  const result = await client
    .schema("app")
    .from("automation_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      error_code: errorCode?.slice(0, 120) ?? null,
      last_heartbeat_at: new Date().toISOString()
    })
    .eq("id", runId);
  if (result.error) throw result.error;
}
