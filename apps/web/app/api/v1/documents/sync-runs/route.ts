import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { inngest } from "@/inngest/client";
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("ingestion_runs")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return apiResponse(data ?? [], request);
  });
}
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId, correlationId }) => {
    const operationKey = request.headers.get("idempotency-key");
    const body = await request.json().catch(() => ({}));
    if (!operationKey) return apiResponse({ code: "IDEMPOTENCY_REQUIRED" }, request, 400);
    const connectionId = typeof body.connectionId === "string" ? body.connectionId : null;
    if (connectionId) {
      const { data: connection, error: connectionError } = await client
        .schema("app")
        .from("integration_connections")
        .select("id")
        .eq("id", connectionId)
        .eq("owner_id", ownerId)
        .maybeSingle();
      if (connectionError) throw connectionError;
      if (!connection) return apiResponse({ code: "CONNECTION_NOT_FOUND" }, request, 404);
    }
    const { data: run, error } = await client
      .schema("app")
      .from("ingestion_runs")
      .insert({
        owner_id: ownerId,
        trigger: typeof body.trigger === "string" ? body.trigger : "manual",
        connection_id: connectionId,
        correlation_id: correlationId,
        idempotency_key: operationKey,
        status: "pending"
      })
      .select("*")
      .single();
    if (error || !run) throw error ?? new Error("INGESTION_RUN_CREATE_FAILED");
    try {
      await inngest.send({
        name: "career/drive.sync.requested.v1",
        id: `${ownerId}:${operationKey}`,
        data: {
          schemaVersion: 1,
          ownerId,
          correlationId,
          resourceType: "ingestion_run",
          resourceId: run.id,
          operationKey,
          requestedBy: "owner",
          metadata: { trigger: typeof body.trigger === "string" ? body.trigger : "manual" },
          runId: run.id,
          cursor: typeof body.cursor === "string" ? body.cursor : null
        }
      });
    } catch {
      await client
        .schema("app")
        .from("ingestion_runs")
        .update({
          status: "failed",
          error_summary: "WORKFLOW_DISPATCH_FAILED",
          finished_at: new Date().toISOString()
        })
        .eq("id", run.id)
        .eq("owner_id", ownerId);
      return apiResponse(
        {
          code: "DRIVE_SYNC_DISPATCH_FAILED",
          detail:
            "The Drive folder is connected, but the workflow runner is unavailable. Restart the development stack with `pnpm dev`, then try again.",
          runId: run.id
        },
        request,
        503
      );
    }
    return apiResponse({ run, dispatchStatus: "sent" }, request, 202);
  });
}
