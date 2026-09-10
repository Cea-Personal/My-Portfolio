import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { diagnosticHash, recordProviderHealthCheck } from "@/lib/server/ai-health";
import { rerankWithProvider, resolveRerankerProviders } from "@/lib/server/reranker-provider";

const HEALTH_QUERY = "Which document describes an engineer's production impact?";
const HEALTH_DOCUMENTS = [
  "Built and operated a production data platform that improved reliability and delivery speed.",
  "A short note about an unrelated calendar appointment."
];

/**
 * Sends a bounded synthetic query to the configured reranker. The diagnostic
 * deliberately contains no career evidence and never returns the provider key.
 */
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const startedAt = performance.now();
    let providerConfigId: string | undefined;
    try {
      const providers = await resolveRerankerProviders(client, ownerId);
      const firstProvider = providers[0];
      if (!firstProvider) throw new Error("RERANKER_NOT_CONFIGURED");

      let selectedProvider = firstProvider;
      let results: readonly { index: number; score: number }[] | undefined;
      let lastError: unknown;
      for (const provider of providers) {
        providerConfigId = provider.id;
        try {
          results = await rerankWithProvider(provider, HEALTH_QUERY, HEALTH_DOCUMENTS);
          selectedProvider = provider;
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (!results) {
        throw lastError instanceof Error ? lastError : new Error("RERANKER_PROVIDER_FAILED");
      }

      const elapsedMs = Math.round(performance.now() - startedAt);
      await recordProviderHealthCheck(client, {
        ownerId,
        providerConfigId: selectedProvider.id,
        task: "reranker_health",
        status: "completed",
        elapsedMs,
        inputHash: diagnosticHash(`${HEALTH_QUERY}\n${HEALTH_DOCUMENTS.join("\n")}`),
        outputHash: diagnosticHash(
          `${selectedProvider.provider}:${selectedProvider.model}:${String(results.length)}`
        )
      });
      return apiResponse(
        {
          ok: true,
          status: "healthy",
          provider: selectedProvider.provider,
          model: selectedProvider.model,
          resultCount: results.length,
          topScore: results[0]?.score,
          elapsedMs,
          checkedAt: new Date().toISOString()
        },
        request
      );
    } catch (error) {
      const detail =
        error instanceof Error ? error.message.slice(0, 240) : "reranker health check failed";
      const elapsedMs = Math.round(performance.now() - startedAt);
      await recordProviderHealthCheck(client, {
        ownerId,
        ...(providerConfigId ? { providerConfigId } : {}),
        task: "reranker_health",
        status: "failed",
        elapsedMs,
        inputHash: diagnosticHash(`${HEALTH_QUERY}\n${HEALTH_DOCUMENTS.join("\n")}`),
        error: detail
      }).catch(() => undefined);
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
