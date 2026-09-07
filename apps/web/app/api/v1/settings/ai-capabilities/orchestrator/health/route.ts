import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { recordProviderHealthCheck } from "@/lib/server/ai-health";
import { generateReasoningJson, resolveReasoningProviders } from "@/lib/server/reasoning-provider";

const HEALTH_TIMEOUT_MS = 120_000;

/**
 * Runs a small, non-domain diagnostic through the configured orchestrator.
 * The endpoint deliberately returns only the provider/model and the bounded
 * JSON response; credentials, prompts, and private workspace data never leave
 * the server.
 */
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const startedAt = performance.now();
    let providerConfigId: string | undefined;
    try {
      const providers = (
        await resolveReasoningProviders(client, ownerId, "writing_assistance")
      ).map((provider) => ({
        ...provider,
        timeoutMs: Math.max(provider.timeoutMs, HEALTH_TIMEOUT_MS)
      }));
      providerConfigId = providers[0]?.id;
      const result = await generateReasoningJson(
        providers,
        [
          "This is an orchestrator health check.",
          "Do not use tools, private data, or external context.",
          'Return exactly one JSON object with status "ok", a short message confirming the child agent completed the diagnostic, empty content and editedText strings, and an empty suggestions array.',
          "Keep the message under 120 characters."
        ].join(" "),
        { healthCheck: true, requestedAt: new Date().toISOString() },
        { task: "writing_assistance" }
      );
      const elapsedMs = Math.round(performance.now() - startedAt);
      await recordProviderHealthCheck(client, {
        ownerId,
        providerConfigId: result.provider.id,
        task: "orchestrator_health",
        status: "completed",
        elapsedMs,
        inputHash: result.inputHash,
        outputHash: result.outputHash
      });
      return apiResponse(
        {
          ok: true,
          status: "healthy",
          provider: result.provider.provider,
          model: result.provider.model,
          elapsedMs,
          output: Object.fromEntries(
            Object.entries(result.output)
              .slice(0, 20)
              .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 500) : value])
          ),
          checkedAt: new Date().toISOString()
        },
        request
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message.slice(0, 240) : "health check failed";
      const elapsedMs = Math.round(performance.now() - startedAt);
      await recordProviderHealthCheck(client, {
        ownerId,
        ...(providerConfigId ? { providerConfigId } : {}),
        task: "orchestrator_health",
        status: "failed",
        elapsedMs,
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
