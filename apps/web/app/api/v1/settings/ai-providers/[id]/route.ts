import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

function providerInput(body: Record<string, unknown>) {
  const capabilities = Array.isArray(body.capabilities)
    ? body.capabilities.filter((value): value is string => typeof value === "string")
    : [];
  return {
    provider: typeof body.provider === "string" ? body.provider.trim() : "",
    model: typeof body.model === "string" ? body.model.trim() : "",
    modelVersion:
      typeof body.modelVersion === "string" && body.modelVersion.trim()
        ? body.modelVersion.trim().slice(0, 80)
        : "unversioned",
    capabilities: capabilities.map((value) => value.trim()).filter(Boolean),
    secretRef: typeof body.secretRef === "string" ? body.secretRef.trim() : null
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withPrivateApi(request, async ({ client }) => {
    const { id } = await params;
    const input = providerInput((await request.json().catch(() => ({}))) as Record<string, unknown>);
    if (!input.provider || !input.model || !input.capabilities.length) {
      return apiResponse({ code: "INVALID_PROVIDER_CONFIGURATION" }, request, 400);
    }
    const { data, error } = await client.schema("app").rpc("update_ai_provider", {
      requested_id: id,
      requested_provider: input.provider,
      requested_model: input.model,
      requested_model_version: input.modelVersion,
      requested_capabilities: input.capabilities,
      requested_secret_ref: input.secretRef
    });
    if (error?.code === "PGRST202")
      return apiResponse(
        {
          code: "AI_PROVIDER_MANAGEMENT_MIGRATION_REQUIRED",
          detail: "Apply Supabase migration 0142_ai_provider_management.sql, then try again."
        },
        request,
        503
      );
    if (error?.code === "23505")
      return apiResponse({ code: "AI_PROVIDER_ALREADY_EXISTS" }, request, 409);
    if (error) throw error;
    return apiResponse({ updated: data === true, providerId: id }, request, data ? 200 : 404);
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withPrivateApi(request, async ({ client }) => {
    const { id } = await params;
    const { data, error } = await client.schema("app").rpc("remove_ai_provider", {
      requested_id: id
    });
    if (error?.code === "PGRST202")
      return apiResponse(
        {
          code: "AI_PROVIDER_MANAGEMENT_MIGRATION_REQUIRED",
          detail: "Apply Supabase migration 0142_ai_provider_management.sql, then try again."
        },
        request,
        503
      );
    if (error) throw error;
    return apiResponse({ removed: data === true, providerId: id }, request, data ? 200 : 404);
  });
}
