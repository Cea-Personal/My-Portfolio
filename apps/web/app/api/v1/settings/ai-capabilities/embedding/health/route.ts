import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { embedWithFallback, resolveEmbeddingProviders } from "@/lib/server/embedding-provider";

export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const startedAt = performance.now();
    try {
      const providers = await resolveEmbeddingProviders(client, ownerId);
      const result = await embedWithFallback(providers, ["Career Brain embedding health check"]);
      await recordAudit(client, ownerId, "embedding_health.succeeded", null, {
        provider: result.provider.provider,
        model: result.provider.model,
        dimensions: result.vectors[0]?.length ?? 0
      });
      return apiResponse(
        {
          ok: true,
          status: "healthy",
          provider: result.provider.provider,
          model: result.provider.model,
          dimensions: result.vectors[0]?.length ?? 0,
          elapsedMs: Math.round(performance.now() - startedAt),
          checkedAt: new Date().toISOString()
        },
        request
      );
    } catch (error) {
      const detail =
        error instanceof Error ? error.message.slice(0, 240) : "embedding health check failed";
      await recordAudit(client, ownerId, "embedding_health.failed", null, {
        code: detail.split(":")[0],
        detail
      });
      return apiResponse(
        {
          ok: false,
          status: "unhealthy",
          detail,
          elapsedMs: Math.round(performance.now() - startedAt),
          checkedAt: new Date().toISOString()
        },
        request,
        503
      );
    }
  });
}

async function recordAudit(
  client: Parameters<Parameters<typeof withPrivateApi>[1]>[0]["client"],
  ownerId: string,
  action: string,
  reason: string | null,
  metadata: Record<string, unknown>
) {
  try {
    await client.schema("app").from("audit_events").insert({
      owner_id: ownerId,
      actor_type: "owner",
      action,
      target_type: "embedding_provider",
      reason,
      after_metadata: metadata
    });
  } catch {
    // Diagnostics must never be hidden by a secondary audit-write failure.
  }
}
