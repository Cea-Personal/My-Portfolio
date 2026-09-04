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
    if (
      typeof body.provider !== "string" ||
      typeof body.model !== "string" ||
      typeof body.modelVersion !== "string" ||
      typeof body.secretRef !== "string" ||
      !capabilities.length
    )
      return apiResponse({ code: "INVALID_PROVIDER_CONFIGURATION" }, request, 400);
    const { data, error } = await client.schema("app").rpc("register_ai_provider", {
      requested_provider: body.provider,
      requested_model: body.model,
      requested_model_version: body.modelVersion,
      requested_capabilities: capabilities,
      requested_secret_ref: body.secretRef
    });
    if (error) throw error;
    return apiResponse({ providerId: data }, request, 201);
  });
}
