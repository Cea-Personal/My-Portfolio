import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { inngest } from "@/inngest/client";

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const [exports, runs] = await Promise.all([
      client
        .schema("app")
        .from("export_requests")
        .select("*")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false }),
      client
        .schema("app")
        .from("automation_runs")
        .select("status,error_code,context_metadata")
        .eq("owner_id", ownerId)
        .eq("workflow_name", "career/export.requested.v1")
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(100)
    ]);
    if (exports.error) throw exports.error;
    if (runs.error) throw runs.error;
    const failures = (runs.data ?? []) as Array<{
      error_code: string | null;
      context_metadata: Record<string, unknown> | null;
    }>;
    return apiResponse(
      {
        exports: (exports.data ?? []).map((item) => {
          const failure = failures.find((run) => run.context_metadata?.resourceId === item.id);
          return failure ? { ...item, error_code: failure.error_code } : item;
        })
      },
      request
    );
  });
}
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const requestedKey = request.headers.get("idempotency-key") ?? `export:${crypto.randomUUID()}`;
    const { data: exportId, error } = await client
      .schema("app")
      .rpc("request_data_export", { requested_key: requestedKey });
    if (error || !exportId) {
      const code = error && typeof error.code === "string" ? error.code : "EXPORT_CREATE_FAILED";
      const message = error && typeof error.message === "string" ? error.message : "";
      const detail =
        code === "42501" ||
        message.includes("OWNER_AUTHORIZATION_REQUIRED") ||
        message.includes("42501")
          ? "This account is signed in but is not configured as the private workspace owner. Add it to app.owner_authorizations in Supabase."
          : message.includes("PGRST") || message.toLowerCase().includes("function")
            ? "The export database function is missing or not deployed. Apply the latest Supabase migrations, including 0110_durable_workflow_recovery.sql."
            : message.includes("INVALID_IDEMPOTENCY_KEY")
              ? "The export request key was rejected. Refresh the page and try again."
              : message.slice(0, 240) || "The export request could not be queued.";
      return apiResponse({ code, detail }, request, 503);
    }
    try {
      // Manual exports are dispatched directly so they do not have to wait
      // for the periodic outbox drain. The outbox row remains the durable
      // source of truth and will safely deduplicate a later replay.
      await inngest.send({
        name: "career/export.requested.v1",
        id: `export-request:${exportId}`,
        data: {
          schemaVersion: 1,
          ownerId,
          correlationId: crypto.randomUUID(),
          resourceType: "export_request",
          resourceId: exportId,
          operationKey: `export:${exportId}`,
          requestedBy: "owner",
          metadata: {}
        }
      });
    } catch {
      // The outbox drain below remains the fallback when direct dispatch is
      // unavailable (for example during a local runner restart).
    }
    // The outbox remains the source of truth, while this best-effort wake-up
    // avoids waiting for the minute-based drain schedule after a manual request.
    try {
      await inngest.send({
        name: "career/outbox.drain.requested.v1",
        id: `export-drain:${exportId}`,
        data: {
          schemaVersion: 1,
          ownerId,
          resourceType: "export_request",
          resourceId: exportId,
          requestedBy: "owner"
        }
      });
    } catch {
      // A queued export can still be picked up by the scheduled drain.
    }
    return apiResponse(
      { export: { id: exportId, format: "json" }, status: "queued" },
      request,
      202
    );
  });
}
