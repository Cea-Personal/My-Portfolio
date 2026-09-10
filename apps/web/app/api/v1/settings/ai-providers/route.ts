import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client }) => {
    const { data, error } = await client.schema("app").rpc("list_available_ai_providers");
    if (error) throw error;
    return apiResponse(data ?? [], request);
  });
}
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client }) => {
    const body = await request.json().catch(() => ({}));
    const capabilities = Array.isArray(body.capabilities)
      ? body.capabilities.filter((value: unknown): value is string => typeof value === "string")
      : [];
    // Keep provider identity stable for embedding cache/retrieval even when a
    // vendor does not publish a separate model version.
    const modelVersion =
      typeof body.modelVersion === "string" && body.modelVersion.trim()
        ? body.modelVersion.trim().slice(0, 80)
        : "unversioned";
    const provider =
      typeof body.provider === "string" ? body.provider.trim().toLocaleLowerCase() : "";
    const requestedModel = typeof body.model === "string" ? body.model.trim() : "";
    const isCohereReranker =
      provider === "cohere" &&
      capabilities.some((capability: string) => /^(rerank|reranker)$/i.test(capability));
    const model = requestedModel || (isCohereReranker ? "rerank-v3.5" : "");
    const secretRef = typeof body.secretRef === "string" ? body.secretRef.trim() : null;
    if (
      !provider ||
      !model ||
      !capabilities.length ||
      (provider !== "codex_app_server" && !secretRef)
    )
      return apiResponse({ code: "INVALID_PROVIDER_CONFIGURATION" }, request, 400);
    const { data, error } = await client.schema("app").rpc("register_ai_provider", {
      requested_provider: provider,
      requested_model: model,
      requested_model_version: modelVersion,
      requested_capabilities: capabilities,
      requested_secret_ref: secretRef
    });
    if (error) throw error;
    return apiResponse({ providerId: data }, request, 201);
  });
}
