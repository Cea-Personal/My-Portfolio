import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { normalizeJobSourceEndpoint, validateSecretReference } from "@/lib/job-source-config";

export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const { data, error } = await client
      .schema("app")
      .from("job_sources")
      .select("*, job_source_configs(*)")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) throw error;
    return apiResponse(data ? { source: data } : null, request, data ? 200 : 404);
  });
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const secretRef =
      body.secretRef === undefined ? undefined : validateSecretReference(body.secretRef);
    const applicationIdRef =
      body.applicationIdRef === undefined
        ? undefined
        : validateSecretReference(body.applicationIdRef);
    const rateLimit =
      body.rateLimitPerMinute === undefined ? undefined : Number(body.rateLimitPerMinute);
    const discoveryFrequency =
      body.discoveryFrequencyMinutes === undefined
        ? undefined
        : Number(body.discoveryFrequencyMinutes);
    const extractionConfig =
      body.extractionConfig === undefined
        ? undefined
        : body.extractionConfig &&
            typeof body.extractionConfig === "object" &&
            !Array.isArray(body.extractionConfig)
          ? body.extractionConfig
          : null;
    if (
      (body.secretRef !== undefined && secretRef === undefined) ||
      (body.applicationIdRef !== undefined && applicationIdRef === undefined) ||
      (rateLimit !== undefined &&
        (!Number.isInteger(rateLimit) || rateLimit < 1 || rateLimit > 300)) ||
      (discoveryFrequency !== undefined &&
        (!Number.isInteger(discoveryFrequency) ||
          discoveryFrequency < 15 ||
          discoveryFrequency > 43200)) ||
      extractionConfig === null
    )
      return apiResponse({ code: "INVALID_SOURCE_CONFIGURATION" }, request, 400);
    const { data: existingSource } = await client
      .schema("app")
      .from("job_sources")
      .select("adapter_type")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (!existingSource) return apiResponse(null, request, 404);
    const endpoint =
      body.endpoint === undefined
        ? undefined
        : normalizeJobSourceEndpoint(body.endpoint, existingSource.adapter_type);
    if (body.endpoint !== undefined && !endpoint)
      return apiResponse({ code: "INVALID_SOURCE_CONFIGURATION" }, request, 400);
    const { data, error } = await client
      .schema("app")
      .from("job_sources")
      .update({
        name: typeof body.name === "string" ? body.name.trim().slice(0, 160) : undefined,
        enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
        terms_note: typeof body.termsNote === "string" ? body.termsNote.slice(0, 1000) : undefined
      })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return apiResponse(null, request, 404);
    if (
      endpoint !== undefined ||
      body.secretRef !== undefined ||
      body.applicationIdRef !== undefined ||
      rateLimit !== undefined ||
      discoveryFrequency !== undefined ||
      extractionConfig !== undefined
    ) {
      const config = await client
        .schema("app")
        .from("job_source_configs")
        .update({
          endpoint,
          secret_ref: secretRef,
          application_id_ref: applicationIdRef,
          rate_limit_per_minute: rateLimit,
          discovery_frequency_minutes: discoveryFrequency,
          extraction_config: extractionConfig ?? undefined,
          schedule_eligible:
            typeof body.scheduleEligible === "boolean" ? body.scheduleEligible : undefined
        })
        .eq("source_id", id);
      if (config.error) throw config.error;
    }
    return apiResponse(data, request);
  });
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const { data, error } = await client
      .schema("app")
      .from("job_sources")
      .delete()
      .eq("id", id)
      .eq("owner_id", ownerId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return apiResponse({ removed: Boolean(data) }, request, data ? 200 : 404);
  });
}
