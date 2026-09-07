import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import {
  getJobSourceAdapter,
  defaultJobSourceEndpoint,
  validateJobSourceEndpoint,
  validateSecretReference
} from "@/lib/job-source-config";

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("job_sources")
      .select(
        "*, job_source_configs(endpoint,secret_ref,rate_limit_per_minute,schedule_eligible,discovery_frequency_minutes,extraction_config,last_test_outcome)"
      )
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return apiResponse({ sources: data ?? [] }, request);
  });
}
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 160) : "";
    const adapterType = typeof body.adapterType === "string" ? body.adapterType : "";
    const adapterVersion = typeof body.adapterVersion === "string" ? body.adapterVersion : "v1";
    const endpoint = validateJobSourceEndpoint(body.endpoint ?? defaultJobSourceEndpoint(adapterType));
    const secretRef = validateSecretReference(body.secretRef);
    const termsNote =
      typeof body.termsNote === "string" ? body.termsNote.trim().slice(0, 1000) : "";
    const rateLimit = Number(body.rateLimitPerMinute ?? 30);
    const discoveryFrequency = Number(body.discoveryFrequencyMinutes ?? 1440);
    const extractionConfig =
      body.extractionConfig &&
      typeof body.extractionConfig === "object" &&
      !Array.isArray(body.extractionConfig)
        ? body.extractionConfig
        : {};
    if (
      !name ||
      !getJobSourceAdapter(adapterType, adapterVersion) ||
      !endpoint ||
      secretRef === undefined ||
      !Number.isInteger(rateLimit) ||
      rateLimit < 1 ||
      rateLimit > 300 ||
      !Number.isInteger(discoveryFrequency) ||
      discoveryFrequency < 15 ||
      discoveryFrequency > 43200 ||
      (adapterType === "linkedin-authorized" && !termsNote)
    )
      return apiResponse({ code: "INVALID_SOURCE" }, request, 400);
    const { data, error } = await client
      .schema("app")
      .from("job_sources")
      .insert({
        owner_id: ownerId,
        name,
        adapter_type: adapterType,
        adapter_version: adapterVersion,
        enabled: body.enabled === true,
        terms_note: termsNote || null
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("SOURCE_CREATE_FAILED");
    const config = await client
      .schema("app")
      .from("job_source_configs")
      .insert({
        source_id: data.id,
        endpoint,
        secret_ref: secretRef,
        rate_limit_per_minute: rateLimit,
        schedule_eligible: body.scheduleEligible === true,
        discovery_frequency_minutes: discoveryFrequency,
        extraction_config: extractionConfig,
        field_mapping:
          body.fieldMapping && typeof body.fieldMapping === "object" ? body.fieldMapping : {}
      });
    if (config.error) {
      await client
        .schema("app")
        .from("job_sources")
        .delete()
        .eq("id", data.id)
        .eq("owner_id", ownerId);
      throw config.error;
    }
    return apiResponse({ source: data }, request, 201);
  });
}
