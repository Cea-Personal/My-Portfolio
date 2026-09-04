import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import {
  connectionInput,
  getJobSourceAdapter,
  validateJobSourceEndpoint
} from "@/lib/job-source-config";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const { data, error } = await client
      .schema("app")
      .from("job_sources")
      .select("id,adapter_type,adapter_version,job_source_configs(endpoint,secret_ref)")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return apiResponse(null, request, 404);
    const rawConfig = Array.isArray(data.job_source_configs)
      ? data.job_source_configs[0]
      : data.job_source_configs;
    const endpoint = validateJobSourceEndpoint(rawConfig?.endpoint);
    const adapter = getJobSourceAdapter(data.adapter_type, data.adapter_version);
    const testedAt = new Date().toISOString();
    const started = performance.now();
    let healthy = false;
    let code = "CONNECTION_FAILED";
    let recordCount = 0;
    if (!endpoint) code = "INVALID_ENDPOINT";
    else if (!adapter) code = "UNSUPPORTED_ADAPTER";
    else {
      try {
        const records = await adapter.collect(
          connectionInput(endpoint, rawConfig?.secret_ref ?? null)
        );
        healthy = true;
        code = "CONNECTED";
        recordCount = records.length;
      } catch (testError) {
        code = testError instanceof Error ? testError.message.slice(0, 80) : "CONNECTION_FAILED";
      }
    }
    const latencyMs = Math.round(performance.now() - started);
    const outcome = JSON.stringify({ code, recordCount, latencyMs, testedAt }).slice(0, 1000);
    const sourceUpdate = await client
      .schema("app")
      .from("job_sources")
      .update({
        health_status: healthy ? "healthy" : "unhealthy",
        last_run_at: testedAt,
        last_success_at: healthy ? testedAt : undefined,
        last_failure_at: healthy ? undefined : testedAt,
        consecutive_failures: healthy ? 0 : 1,
        last_discovered_count: recordCount,
        last_accepted_count: recordCount
      })
      .eq("id", id)
      .eq("owner_id", ownerId);
    if (sourceUpdate.error) throw sourceUpdate.error;
    const configUpdate = await client
      .schema("app")
      .from("job_source_configs")
      .update({ last_test_outcome: outcome })
      .eq("source_id", id);
    if (configUpdate.error) throw configUpdate.error;
    return apiResponse(
      {
        healthy,
        adapter: `${data.adapter_type}@${data.adapter_version}`,
        capabilities: adapter?.capabilities ?? [],
        recordCount,
        latencyMs,
        code,
        testedAt,
        credentialConfigured: Boolean(rawConfig?.secret_ref)
      },
      request,
      healthy ? 200 : 422
    );
  });
}
