import type { SupabaseClient } from "@supabase/supabase-js";
import { aiRuntimeClient } from "./ai-runtime-client";

interface ProviderRow {
  id: string;
  provider: string;
  model: string;
  model_version: string;
  capabilities: string[];
  secret_ref: string | null;
}

export interface ResolvedRerankerProvider extends ProviderRow {
  apiKey: string;
  endpoint: string;
}

function endpointFor(provider: ProviderRow): string {
  const environmentName = `${provider.provider.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_RERANK_URL`;
  const configured = process.env[environmentName]?.trim();
  if (configured) return configured;
  if (provider.provider === "cohere") return "https://api.cohere.com/v2/rerank";
  throw new Error(`RERANKER_ENDPOINT_MISSING:${environmentName}`);
}

export async function resolveRerankerProviders(
  client: SupabaseClient,
  ownerId: string
): Promise<ResolvedRerankerProvider[]> {
  const runtimeClient = aiRuntimeClient(client);
  const { data: capability, error } = await runtimeClient
    .schema("app")
    .from("ai_capability_configs")
    .select("provider_config_id,fallback_provider_config_id")
    .eq("owner_id", ownerId)
    .eq("task_type", "reranker")
    .eq("enabled", true)
    .maybeSingle();
  if (error) throw error;
  if (!capability) return [];

  const ids = [capability.provider_config_id, capability.fallback_provider_config_id].filter(
    (id): id is string => typeof id === "string"
  );
  if (!ids.length) return [];
  const providers = await runtimeClient
    .schema("app")
    .from("ai_provider_configs")
    .select("id,provider,model,model_version,capabilities,secret_ref")
    .in("id", ids)
    .eq("enabled", true);
  if (providers.error) throw providers.error;
  const rows = providers.data as ProviderRow[];
  return ids.flatMap((id) => {
    const row = rows.find((candidate) => candidate.id === id);
    if (
      !row ||
      !row.capabilities.some((capabilityName) => /^(\*|rerank|reranker)$/i.test(capabilityName))
    )
      return [];
    if (!row.secret_ref) throw new Error("RERANKER_SECRET_REFERENCE_MISSING");
    const apiKey = process.env[row.secret_ref]?.trim();
    if (!apiKey) throw new Error(`RERANKER_SECRET_MISSING:${row.secret_ref}`);
    if (/^secret:\/\//i.test(apiKey))
      throw new Error(`RERANKER_SECRET_UNRESOLVED:${row.secret_ref}`);
    return [{ ...row, apiKey, endpoint: endpointFor(row) }];
  });
}

export async function rerankWithProvider(
  provider: ResolvedRerankerProvider,
  query: string,
  documents: string[],
  signal?: AbortSignal
): Promise<readonly { index: number; score: number }[]> {
  if (!documents.length) return [];
  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${provider.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: provider.model,
      query,
      documents,
      top_n: documents.length,
      return_documents: false
    }),
    signal: signal ?? AbortSignal.timeout(30_000)
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let detail = body;
    try {
      const parsed = JSON.parse(body) as { message?: string; error?: string };
      detail = parsed.message ?? parsed.error ?? body;
    } catch {
      // Preserve a bounded plain-text provider diagnostic.
    }
    throw new Error(
      `RERANKER_PROVIDER_HTTP_${String(response.status)}${detail.trim() ? `:${detail.trim().slice(0, 180)}` : ""}`
    );
  }
  const payload = (await response.json()) as {
    results?: Array<{ index?: number; relevance_score?: number; score?: number }>;
  };
  const results = (payload.results ?? [])
    .flatMap((item) => {
      const index = item.index;
      const score = item.relevance_score ?? item.score;
      return typeof index === "number" &&
        Number.isInteger(index) &&
        typeof score === "number" &&
        Number.isFinite(score)
        ? [{ index, score }]
        : [];
    })
    .filter((item) => item.index >= 0 && item.index < documents.length);
  if (!results.length) throw new Error("RERANKER_PROVIDER_RESPONSE_INVALID");
  return results;
}

export async function rerankWithFallback(
  providers: ResolvedRerankerProvider[],
  query: string,
  documents: string[]
): Promise<readonly { index: number; score: number }[]> {
  let lastError: unknown;
  for (const provider of providers) {
    try {
      return await rerankWithProvider(provider, query, documents);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("RERANKER_PROVIDER_FAILED");
}

export async function rerankCandidates<T extends { content: string }>(
  client: SupabaseClient,
  ownerId: string,
  query: string,
  candidates: readonly T[],
  limit = candidates.length
): Promise<T[]> {
  if (!candidates.length || !query.trim()) return candidates.slice(0, limit);
  let providers: ResolvedRerankerProvider[];
  try {
    providers = await resolveRerankerProviders(client, ownerId);
  } catch {
    // Reranking is an optional precision layer. Retrieval remains available
    // when no reranker is configured or a provider is temporarily unavailable.
    return candidates.slice(0, limit);
  }
  if (!providers.length) return candidates.slice(0, limit);
  try {
    const results = await rerankWithFallback(
      providers,
      query.slice(0, 8_000),
      candidates.map((candidate) => candidate.content.slice(0, 8_000))
    );
    return [...results]
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .slice(0, limit)
      .map((result) => candidates[result.index])
      .filter((candidate): candidate is T => Boolean(candidate));
  } catch {
    return candidates.slice(0, limit);
  }
}
