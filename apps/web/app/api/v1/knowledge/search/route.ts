import { createServiceSupabaseClient } from "@career-os/database/service";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { embedWithFallback, resolveEmbeddingProviders } from "@/lib/server/embedding-provider";

export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    const query = typeof body.query === "string" ? body.query.trim().slice(0, 4_000) : "";
    const kinds = Array.isArray(body.documentKinds)
      ? body.documentKinds.filter(
          (kind: unknown): kind is string =>
            typeof kind === "string" && ["resume", "cover_letter", "other"].includes(kind)
        )
      : null;
    if (!query) return apiResponse({ code: "QUERY_REQUIRED" }, request, 400);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key)
      return apiResponse({ code: "EMBEDDING_CONFIGURATION_UNAVAILABLE" }, request, 503);
    const serviceClient = createServiceSupabaseClient(url, key);
    const providers = await resolveEmbeddingProviders(serviceClient, ownerId);
    const { provider, vectors } = await embedWithFallback(providers, [query]);
    const vector = vectors[0];
    if (!vector) return apiResponse({ code: "QUERY_EMBEDDING_FAILED" }, request, 502);
    const { data, error } = await client.schema("app").rpc("match_private_evidence", {
      requested_embedding: `[${vector.join(",")}]`,
      requested_provider: provider.provider,
      requested_model: provider.model,
      requested_model_version: provider.model_version,
      requested_kinds: kinds,
      requested_limit: Math.min(Math.max(Number(body.limit) || 12, 1), 50),
      requested_min_similarity: Math.min(Math.max(Number(body.minSimilarity) || 0.2, 0), 1)
    });
    if (error) throw error;
    return apiResponse(
      {
        results: data ?? [],
        provider: provider.provider,
        model: provider.model,
        modelVersion: provider.model_version
      },
      request
    );
  });
}
