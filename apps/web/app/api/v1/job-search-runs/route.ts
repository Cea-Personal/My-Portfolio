import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { inngest } from "@/inngest/client";

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("job_search_runs")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return apiResponse({ runs: data ?? [] }, request);
  });
}
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId, correlationId }) => {
    const operationKey = request.headers.get("idempotency-key");
    const body = await request.json().catch(() => ({}));
    if (!operationKey || typeof body.profileId !== "string")
      return apiResponse({ code: "PROFILE_REQUIRED" }, request, 400);
    const profile = await client
      .schema("app")
      .from("job_search_profiles")
      .select("id")
      .eq("id", body.profileId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (profile.error) throw profile.error;
    if (!profile.data) return apiResponse({ code: "PROFILE_NOT_FOUND" }, request, 404);
    const requestedSourceIds = Array.isArray(body.sourceIds)
      ? body.sourceIds.filter((value: unknown): value is string => typeof value === "string")
      : [];
    const sourceQuery = client
      .schema("app")
      .from("job_sources")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("enabled", true);
    const sourceResult = requestedSourceIds.length
      ? await sourceQuery.in("id", requestedSourceIds)
      : await sourceQuery;
    if (sourceResult.error) throw sourceResult.error;
    const sourceIds = (sourceResult.data ?? [])
      .map((source) => source.id)
      .filter((value): value is string => typeof value === "string");
    const { data, error } = await client
      .schema("app")
      .from("job_search_runs")
      .insert({
        owner_id: ownerId,
        profile_id: body.profileId,
        trigger_type: typeof body.triggerType === "string" ? body.triggerType : "manual",
        logical_date:
          typeof body.logicalDate === "string"
            ? body.logicalDate
            : new Date().toISOString().slice(0, 10),
        correlation_id: correlationId,
        status: "pending"
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("SEARCH_RUN_CREATE_FAILED");
    if (sourceIds.length) {
      const { error: sourceError } = await client
        .schema("app")
        .from("job_search_run_sources")
        .upsert(
          sourceIds.map((sourceId) => ({ run_id: data.id, source_id: sourceId })),
          { onConflict: "run_id,source_id" }
        );
      if (sourceError) throw sourceError;
    }
    try {
      await inngest.send({
        name: "career/job-search.requested.v1",
        id: `${ownerId}:${operationKey}`,
        data: {
          schemaVersion: 1,
          ownerId,
          correlationId,
          resourceType: "job_search_run",
          resourceId: data.id,
          operationKey,
          requestedBy: "owner",
          metadata: { trigger: typeof body.triggerType === "string" ? body.triggerType : "manual" },
          runId: data.id,
          profileId: body.profileId,
          sourceIds
        }
      });
    } catch (error) {
      await client
        .schema("app")
        .from("job_search_runs")
        .update({ status: "failed", error_summary: "WORKFLOW_DISPATCH_FAILED" })
        .eq("id", data.id)
        .eq("owner_id", ownerId);
      throw error;
    }
    return apiResponse({ run: data, status: data.status }, request, 202);
  });
}
