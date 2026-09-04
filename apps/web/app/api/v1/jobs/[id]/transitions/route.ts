import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { jobStatuses, transitionJob, type JobStatus } from "@career-os/jobs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (!jobStatuses.includes(body.status as JobStatus))
      return apiResponse({ code: "INVALID_TRANSITION" }, request, 400);
    const { data: current, error: currentError } = await client
      .schema("app")
      .from("jobs")
      .select("status")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) return apiResponse(null, request, 404);
    try {
      transitionJob(current.status as JobStatus, body.status as JobStatus);
    } catch {
      return apiResponse(
        {
          code: "INVALID_TRANSITION",
          detail: `${current.status} cannot transition to ${String(body.status)}`
        },
        request,
        409
      );
    }
    const { data, error } = await client
      .schema("app")
      .from("jobs")
      .update({ status: body.status })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .eq("status", current.status)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return apiResponse({ code: "JOB_CHANGED_RELOAD" }, request, 409);
    const history = await client
      .schema("app")
      .from("job_status_history")
      .insert({
        job_id: id,
        from_status: current.status,
        to_status: body.status,
        actor_id: ownerId,
        reason: typeof body.reason === "string" ? body.reason.slice(0, 1000) : null
      });
    if (history.error) throw history.error;
    return apiResponse({ transitioned: true, job: data }, request);
  });
}
