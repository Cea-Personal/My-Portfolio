import { inngest } from "./client";
import { createServiceSupabaseClient } from "@career-os/database";

function configuredClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceRoleKey ? createServiceSupabaseClient(url, serviceRoleKey) : null;
}

export const driveSync = inngest.createFunction(
  { id: "drive-sync", retries: 3, triggers: [{ event: "career/drive.sync.requested.v1" }] },
  async ({ event, step }) => {
    const ownerId = typeof event.data.ownerId === "string" ? event.data.ownerId : null;
    const runId = typeof event.data.runId === "string" ? event.data.runId : null;
    const client = configuredClient();
    if (!ownerId || !runId) return { status: "failed" as const, reason: "INVALID_SYNC_EVENT" };
    if (!client) {
      return {
        status: "deferred" as const,
        reason: "SUPABASE_SERVICE_ROLE_NOT_CONFIGURED",
        runId
      };
    }
    const started = await client
      .schema("app")
      .from("ingestion_runs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", runId)
      .eq("owner_id", ownerId);
    if (started.error) throw started.error;
    try {
      const cursor = await step.run("reconcile", async () => ({
        ownerId,
        cursor: (event.data.cursor as string | undefined) ?? null,
        changed: Array.isArray(event.data.changes) ? event.data.changes.length : 0,
        idempotencyKey: event.data.operationKey as string
      }));
      const finished = await client
        .schema("app")
        .from("ingestion_runs")
        .update({
          status: "completed",
          document_count: cursor.changed,
          finished_at: new Date().toISOString(),
          error_summary: null
        })
        .eq("id", runId)
        .eq("owner_id", ownerId);
      if (finished.error) throw finished.error;
      return { ...cursor, status: "completed" as const, resumable: true, runId };
    } catch (error) {
      await client
        .schema("app")
        .from("ingestion_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error_summary: error instanceof Error ? error.message.slice(0, 500) : "SYNC_FAILED"
        })
        .eq("id", runId)
        .eq("owner_id", ownerId);
      throw error;
    }
  }
);
