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

export interface ResolvedImageProvider extends ProviderRow {
  apiKey: string;
  endpoint: string;
}

export interface GeneratedImage {
  bytes: Uint8Array;
  mediaType: "image/png" | "image/jpeg" | "image/webp";
}

export interface ReferenceImage {
  bytes: Uint8Array;
  mediaType: "image/png" | "image/jpeg" | "image/webp";
  filename?: string;
}

function endpointFor(provider: ProviderRow) {
  const environmentName = `${provider.provider.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_IMAGES_URL`;
  const configured = process.env[environmentName]?.trim();
  if (configured) return configured;
  if (provider.provider === "openai") return "https://api.openai.com/v1/images/generations";
  throw new Error(`IMAGE_GENERATION_ENDPOINT_MISSING:${environmentName}`);
}

export async function resolveImageGenerationProviders(
  client: SupabaseClient,
  ownerId: string
): Promise<ResolvedImageProvider[]> {
  const runtimeClient = aiRuntimeClient(client);
  const capability = await runtimeClient
    .schema("app")
    .from("ai_capability_configs")
    .select("provider_config_id,fallback_provider_config_id")
    .eq("owner_id", ownerId)
    .eq("task_type", "image_generation")
    .eq("enabled", true)
    .maybeSingle();
  if (capability.error) throw capability.error;
  if (!capability.data) throw new Error("IMAGE_GENERATION_PROVIDER_NOT_CONFIGURED");
  const ids = [capability.data.provider_config_id, capability.data.fallback_provider_config_id].filter(
    (id): id is string => typeof id === "string"
  );
  const providers = await runtimeClient
    .schema("app")
    .from("ai_provider_configs")
    .select("id,provider,model,model_version,capabilities,secret_ref")
    .in("id", ids)
    .eq("enabled", true);
  if (providers.error) throw providers.error;
  return ids.flatMap((id) => {
    const provider = (providers.data as ProviderRow[] | null)?.find((row) => row.id === id);
    if (!provider) return [];
    if (
      !provider.capabilities.some((capabilityName) =>
        /^(\*|image|images|image_generation)$/i.test(capabilityName)
      )
    )
      return [];
    if (!provider.secret_ref) throw new Error("IMAGE_GENERATION_SECRET_REFERENCE_MISSING");
    const apiKey = process.env[provider.secret_ref]?.trim();
    if (!apiKey) throw new Error(`IMAGE_GENERATION_SECRET_MISSING:${provider.secret_ref}`);
    return [{ ...provider, apiKey, endpoint: endpointFor(provider) }];
  });
}

function mediaTypeFor(value: string | null | undefined): GeneratedImage["mediaType"] {
  if (value?.toLowerCase().includes("jpeg") || value?.toLowerCase().includes("jpg"))
    return "image/jpeg";
  if (value?.toLowerCase().includes("webp")) return "image/webp";
  return "image/png";
}

function decodeBase64(value: string) {
  const encoded = value.replace(/^data:[^;]+;base64,/, "");
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length) throw new Error("IMAGE_GENERATION_RESPONSE_INVALID");
  return new Uint8Array(bytes);
}

export async function generateImageWithProvider(
  provider: ResolvedImageProvider,
  prompt: string,
  referenceImages: ReferenceImage[] = [],
  signal?: AbortSignal
): Promise<GeneratedImage> {
  const requestSignal = signal ?? AbortSignal.timeout(120_000);
  let response: Response;
  if (referenceImages.length > 0) {
    // OpenAI-compatible image APIs accept reference artwork through the edits
    // endpoint. Keep the generations endpoint for requests without references,
    // preserving compatibility with providers that only implement generations.
    const editEndpoint = provider.endpoint.replace(/\/images\/generations(?:\/?$)/i, "/images/edits");
    const form = new FormData();
    form.set("model", provider.model);
    form.set("prompt", prompt);
    form.set("n", "1");
    form.set("size", "1536x1024");
    // Do not send `response_format` here. OpenAI's current image models return
    // b64_json by default and reject the legacy parameter on the edits API.
    for (const [index, reference] of referenceImages.entries()) {
      const copy = new ArrayBuffer(reference.bytes.byteLength);
      new Uint8Array(copy).set(reference.bytes);
      form.append(
        "image[]",
        new Blob([copy], { type: reference.mediaType }),
        reference.filename?.trim() || `reference-${String(index + 1)}.png`
      );
    }
    response = await fetch(editEndpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${provider.apiKey}` },
      body: form,
      signal: requestSignal
    });
  } else {
    response = await fetch(provider.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${provider.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: provider.model,
        prompt,
        n: 1,
        size: "1536x1024"
      }),
      signal: requestSignal
    });
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let detail = body;
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      detail = parsed.error?.message ?? body;
    } catch {
      // Keep a bounded provider diagnostic below.
    }
    throw new Error(
      `IMAGE_GENERATION_PROVIDER_HTTP_${String(response.status)}${detail.trim() ? `:${detail.trim().slice(0, 180)}` : ""}`
    );
  }
  const payload = (await response.json().catch(() => null)) as {
    data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
  } | null;
  const first = payload?.data?.[0];
  if (!first) throw new Error("IMAGE_GENERATION_RESPONSE_INVALID");
  if (typeof first.b64_json === "string" && first.b64_json.trim()) {
    return { bytes: decodeBase64(first.b64_json), mediaType: "image/png" };
  }
  if (typeof first.url !== "string" || !/^https?:\/\//i.test(first.url))
    throw new Error("IMAGE_GENERATION_RESPONSE_INVALID");
  const image = await fetch(first.url, { signal: signal ?? AbortSignal.timeout(60_000) });
  if (!image.ok) throw new Error(`IMAGE_GENERATION_DOWNLOAD_FAILED:${String(image.status)}`);
  const bytes = new Uint8Array(await image.arrayBuffer());
  if (!bytes.length || bytes.byteLength > 10 * 1024 * 1024)
    throw new Error("IMAGE_GENERATION_IMAGE_SIZE_INVALID");
  return { bytes, mediaType: mediaTypeFor(image.headers.get("content-type")) };
}

export async function generateImageWithFallback(
  providers: ResolvedImageProvider[],
  prompt: string,
  referenceImages: ReferenceImage[] = []
): Promise<{ provider: ResolvedImageProvider; image: GeneratedImage }> {
  let lastError: unknown;
  for (const provider of providers) {
    try {
      return { provider, image: await generateImageWithProvider(provider, prompt, referenceImages) };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("IMAGE_GENERATION_PROVIDER_FAILED");
}
