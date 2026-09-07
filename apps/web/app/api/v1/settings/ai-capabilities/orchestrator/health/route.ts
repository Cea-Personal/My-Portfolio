import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
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
    try {
      const providers = (
        await resolveReasoningProviders(client, ownerId, "writing_assistance")
      ).map((provider) => ({
        ...provider,
        timeoutMs: Math.max(provider.timeoutMs, HEALTH_TIMEOUT_MS)
      }));
      const result = await generateReasoningJson(
        providers,
        [
          "This is an orchestrator health check.",
          "Do not use tools, private data, or external context.",
          'Return exactly one JSON object with status "ok" and a short message confirming the child agent completed the diagnostic.',
          "Keep the message under 120 characters."
        ].join(" "),
        { healthCheck: true, requestedAt: new Date().toISOString() },
        { task: "writing_assistance" }
      );
      return apiResponse(
        {
          ok: true,
          status: "healthy",
          provider: result.provider.provider,
          model: result.provider.model,
          elapsedMs: Math.round(performance.now() - startedAt),
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
