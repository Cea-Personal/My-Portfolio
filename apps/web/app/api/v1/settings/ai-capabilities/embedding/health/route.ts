import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { diagnosticHash, recordProviderHealthCheck } from "@/lib/server/ai-health";
import { embedWithFallback, resolveEmbeddingProviders } from "@/lib/server/embedding-provider";

const HEALTH_INPUT = "Career Brain embedding health check";

export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const startedAt = performance.now();
    let providerConfigId: string | undefined;
    try {
      const providers = await resolveEmbeddingProviders(client, ownerId);
      providerConfigId = providers[0]?.id;
      const result = await embedWithFallback(providers, [HEALTH_INPUT]);
      const elapsedMs = Math.round(performance.now() - startedAt);
      await recordProviderHealthCheck(client, {
        ownerId,
        providerConfigId: result.provider.id,
        task: "embedding_health",
        status: "completed",
        elapsedMs,
        inputHash: diagnosticHash(HEALTH_INPUT),
        outputHash: diagnosticHash(
          `${result.provider.provider}:${result.provider.model}:${String(result.vectors[0]?.length ?? 0)}`
        )
      });
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
          elapsedMs,
          checkedAt: new Date().toISOString()
        },
        request
      );
    } catch (error) {
      const detail =
        error instanceof Error ? error.message.slice(0, 240) : "embedding health check failed";
      const elapsedMs = Math.round(performance.now() - startedAt);
      await recordProviderHealthCheck(client, {
        ownerId,
        ...(providerConfigId ? { providerConfigId } : {}),
        task: "embedding_health",
        status: "failed",
        elapsedMs,
        inputHash: diagnosticHash(HEALTH_INPUT),
        error: detail
      }).catch(() => undefined);
      await recordAudit(client, ownerId, "embedding_health.failed", null, {
        code: detail.split(":")[0],
        detail
      });
      return apiResponse(
        {
          ok: false,
          status: "unhealthy",
          detail,
          elapsedMs,
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
