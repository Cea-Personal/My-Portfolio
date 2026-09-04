import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id: jobId } = await params;
    const parsedBody = await request.json().catch(() => ({}));
    const body =
      parsedBody && typeof parsedBody === "object"
        ? (parsedBody as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const { data: job, error: jobError } = await client
      .schema("app")
      .from("jobs")
      .select("id,status")
      .eq("id", jobId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (jobError) throw jobError;
    if (!job) return apiResponse(null, request, 404);
    const existing = await client
      .schema("app")
      .from("applications")
      .select("*")
      .eq("owner_id", ownerId)
      .eq("job_id", jobId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return apiResponse(existing.data, request);
    if (
      !["shortlisted", "interested", "preparing_application", "ready_to_apply"].includes(job.status)
    )
      return apiResponse(
        {
          code: "JOB_NOT_READY_FOR_APPLICATION",
          detail: "Shortlist or mark the job interested first."
        },
        request,
        409
      );
    const { data: defaultProfile, error: profileError } = await client
      .schema("app")
      .from("application_profiles")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("status", "approved")
      .eq("is_default", true)
      .is("archived_at", null)
      .maybeSingle();
    if (profileError) throw profileError;
    let selectedProfileId = defaultProfile?.id ?? null;
    if (
      body.applicationProfileId !== undefined &&
      body.applicationProfileId !== null &&
      body.applicationProfileId !== ""
    ) {
      if (typeof body.applicationProfileId !== "string")
        return apiResponse({ code: "INVALID_APPLICATION_PROFILE" }, request, 400);
      const selected = await client
        .schema("app")
        .from("application_profiles")
        .select("id,status")
        .eq("id", body.applicationProfileId)
        .eq("owner_id", ownerId)
        .is("archived_at", null)
        .maybeSingle();
      if (selected.error) throw selected.error;
      if (!selected.data || selected.data.status !== "approved")
        return apiResponse(
          {
            code: "APPLICATION_PROFILE_NOT_APPROVED",
            detail: "Choose an approved application profile."
          },
          request,
          409
        );
      selectedProfileId = selected.data.id;
    }
    const { data, error } = await client
      .schema("app")
      .from("applications")
      .insert({
        owner_id: ownerId,
        job_id: jobId,
        status: "draft",
        application_profile_id: selectedProfileId,
        started_at: new Date().toISOString()
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("APPLICATION_CREATE_FAILED");
    const history = await client.schema("app").from("application_status_history").insert({
      application_id: data.id,
      from_status: null,
      to_status: "draft",
      actor_id: ownerId,
      reason: "created_from_job"
    });
    if (history.error) throw history.error;
    await client
      .schema("app")
      .from("jobs")
      .update({ status: "preparing_application" })
      .eq("id", jobId)
      .eq("owner_id", ownerId)
      .in("status", ["interested", "shortlisted", "ready_to_apply"]);
    return apiResponse(data, request, 201);
  });
}
