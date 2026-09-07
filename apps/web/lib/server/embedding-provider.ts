import type { SupabaseClient } from "@supabase/supabase-js";

export const PRODUCTION_EMBEDDING_DIMENSIONS = 1536;

interface ProviderRow {
  id: string;
  provider: string;
  model: string;
  model_version: string;
  capabilities: string[];
  secret_ref: string | null;
}

export interface ResolvedEmbeddingProvider extends ProviderRow {
  apiKey: string;
  endpoint: string;
}

function endpointFor(provider: ProviderRow): string {
  const environmentName = `${provider.provider.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_EMBEDDINGS_URL`;
  const configured = process.env[environmentName]?.trim();
  if (configured) return configured;
  if (provider.provider === "openai") return "https://api.openai.com/v1/embeddings";
  throw new Error(`EMBEDDING_ENDPOINT_MISSING:${environmentName}`);
}

async function providerRows(client: SupabaseClient, ids: string[]): Promise<ProviderRow[]> {
  if (!ids.length) return [];
  const { data, error } = await client
    .schema("app")
    .from("ai_provider_configs")
    .select("id,provider,model,model_version,capabilities,secret_ref")
    .in("id", ids)
    .eq("enabled", true);
  if (error) throw error;
  return data as ProviderRow[];
}

export async function resolveEmbeddingProviders(
  client: SupabaseClient,
  ownerId: string
): Promise<ResolvedEmbeddingProvider[]> {
  const { data: capability, error } = await client
    .schema("app")
    .from("ai_capability_configs")
    .select("provider_config_id,fallback_provider_config_id")
    .eq("owner_id", ownerId)
    .eq("task_type", "embedding")
    .eq("enabled", true)
    .maybeSingle();
  if (error) throw error;
  if (!capability) throw new Error("EMBEDDING_PROVIDER_NOT_CONFIGURED");
  const ids = [capability.provider_config_id, capability.fallback_provider_config_id].filter(
    (id): id is string => typeof id === "string"
  );
  const rows = await providerRows(client, ids);
  const resolved = ids
    .map((id) => rows.find((row) => row.id === id))
    .flatMap((row) => {
      if (!row) return [];
      if (
        !row.capabilities.some((capabilityName) => /^(embedding|embeddings)$/i.test(capabilityName))
      ) {
        return [];
      }
      if (!row.secret_ref) throw new Error("EMBEDDING_SECRET_REFERENCE_MISSING");
      const apiKey = process.env[row.secret_ref]?.trim();
      if (!apiKey) throw new Error(`EMBEDDING_SECRET_MISSING:${row.secret_ref}`);
      if (/^secret:\/\//i.test(apiKey)) {
        throw new Error(`EMBEDDING_SECRET_UNRESOLVED:${row.secret_ref}`);
      }
      return [{ ...row, apiKey, endpoint: endpointFor(row) }];
    });
  if (!resolved.length) throw new Error("EMBEDDING_PROVIDER_NOT_AVAILABLE");
  return resolved;
}

export async function embedWithProvider(
  provider: ResolvedEmbeddingProvider,
  inputs: string[],
  signal?: AbortSignal
): Promise<number[][]> {
  if (!inputs.length) return [];
  // `dimensions` is supported by OpenAI's text-embedding-3 family, but not by
  // older models (or by every OpenAI-compatible gateway). The database stores
  // a 1536-dimensional vector, so gateways that omit this option must still
  // return that size and will be rejected below with a useful diagnostic.
  const supportsDimensions = /^text-embedding-3(?:-|$)/i.test(provider.model);
  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${provider.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: provider.model,
      input: inputs,
      encoding_format: "float",
      ...(supportsDimensions ? { dimensions: PRODUCTION_EMBEDDING_DIMENSIONS } : {})
    }),
    signal: signal ?? AbortSignal.timeout(60_000)
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let detail = body;
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      detail = parsed.error?.message ?? body;
    } catch {
      // Preserve a bounded plain-text provider diagnostic.
    }
    throw new Error(
      `EMBEDDING_PROVIDER_HTTP_${String(response.status)}${detail.trim() ? `:${detail.trim().slice(0, 180)}` : ""}`
    );
  }
  const payload = (await response.json()) as {
    data?: Array<{ index?: number; embedding?: number[] }>;
  };
  const ordered = [...(payload.data ?? [])].sort(
    (left, right) => (left.index ?? 0) - (right.index ?? 0)
  );
  if (ordered.length !== inputs.length) throw new Error("EMBEDDING_PROVIDER_RESPONSE_INVALID");
  for (const item of ordered) {
    if (!Array.isArray(item.embedding) || item.embedding.some((value) => !Number.isFinite(value)))
      throw new Error("EMBEDDING_PROVIDER_RESPONSE_INVALID");
    if (item.embedding.length !== PRODUCTION_EMBEDDING_DIMENSIONS)
      throw new Error(
        `EMBEDDING_PROVIDER_DIMENSIONS_INVALID:received=${String(item.embedding.length)},expected=${String(PRODUCTION_EMBEDDING_DIMENSIONS)}`
      );
  }
  return ordered.map((item) => {
    if (!item.embedding) throw new Error("EMBEDDING_PROVIDER_RESPONSE_INVALID");
    return item.embedding;
  });
}

export async function embedWithFallback(
  providers: ResolvedEmbeddingProvider[],
  inputs: string[]
): Promise<{ provider: ResolvedEmbeddingProvider; vectors: number[][] }> {
  if (!providers.length) throw new Error("EMBEDDING_PROVIDER_NOT_AVAILABLE");
  let lastError: unknown;
  for (const provider of providers) {
    try {
      return { provider, vectors: await embedWithProvider(provider, inputs) };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("EMBEDDING_PROVIDER_FAILED");
}
