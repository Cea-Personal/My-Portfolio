import { inngest } from "@/inngest/client";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { resolveEmbeddingProviders } from "@/lib/server/embedding-provider";

export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, correlationId, ownerId }) => {
    const operationKey = request.headers.get("idempotency-key");
    if (!operationKey) return apiResponse({ code: "IDEMPOTENCY_REQUIRED" }, request, 400);

    const [provider] = await resolveEmbeddingProviders(client, ownerId);
    if (!provider)
      return apiResponse(
        {
          code: "EMBEDDING_PROVIDER_NOT_AVAILABLE",
          detail: "Configure and enable an embedding provider before re-indexing knowledge."
        },
        request,
        409
      );
    const { data: run, error } = await client
      .schema("app")
      .from("ingestion_runs")
      .insert({
        owner_id: ownerId,
        trigger: "embedding_backfill",
        correlation_id: correlationId,
        idempotency_key: `embedding-backfill:${operationKey}`.slice(0, 240),
        status: "pending"
      })
      .select("id,status")
      .single();
    if (error || !run) throw error ?? new Error("EMBEDDING_BACKFILL_RUN_CREATE_FAILED");

    try {
      await inngest.send({
        name: "career/embeddings.backfill.requested.v1",
        id: `${ownerId}:embedding-backfill:${operationKey}`,
        data: {
          schemaVersion: 1,
          ownerId,
          correlationId,
          resourceType: "knowledge_base",
          resourceId: run.id,
          operationKey,
          requestedBy: "owner",
          metadata: { ingestionRunId: run.id }
        }
      });
    } catch {
      await client
        .schema("app")
        .from("ingestion_runs")
        .update({
          status: "failed",
          error_summary: "EVENT_DISPATCH_FAILED",
          finished_at: new Date().toISOString()
        })
        .eq("id", run.id)
        .eq("owner_id", ownerId);
      return apiResponse(
        {
          code: "EMBEDDING_BACKFILL_DISPATCH_FAILED",
          detail: "The re-indexing workflow could not be dispatched. Verify Inngest is running."
        },
        request,
        503
      );
    }

    return apiResponse(
      {
        runId: run.id,
        status: run.status,
        provider: provider.provider,
        model: provider.model,
        modelVersion: provider.model_version
      },
      request,
      202
    );
  });
}
