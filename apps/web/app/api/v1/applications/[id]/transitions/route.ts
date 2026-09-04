import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import {
  applicationStatuses,
  transitionApplication,
  type ApplicationStatus
} from "@career-os/applications";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { data: current } = await client
      .schema("app")
      .from("applications")
      .select("status,revision,job_id")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (!current) return apiResponse(null, request, 404);
    const currentRevision =
      typeof current.revision === "number" && Number.isInteger(current.revision)
        ? current.revision
        : 0;
    const status = body.status as ApplicationStatus;
    if (!applicationStatuses.includes(status))
      return apiResponse({ code: "INVALID_APPLICATION_TRANSITION" }, request, 400);
    try {
      transitionApplication(
        {
          id,
          ownerId,
          jobId: current.job_id,
          status: current.status as ApplicationStatus,
          revision: currentRevision
        },
        status,
        currentRevision
      );
    } catch {
      return apiResponse(
        {
          code: "INVALID_APPLICATION_TRANSITION",
          detail: `${current.status} cannot transition to ${status}`
        },
        request,
        409
      );
    }
    const { data, error } = await client
      .schema("app")
      .from("applications")
      .update({
        status,
        revision: currentRevision + 1,
        applied_at: status === "submitted" ? new Date().toISOString() : undefined,
        closed_at:
          status === "closed" || status === "withdrawn" ? new Date().toISOString() : undefined
      })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .eq("revision", currentRevision)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return apiResponse({ code: "APPLICATION_CHANGED_RELOAD" }, request, 409);
    const history = await client
      .schema("app")
      .from("application_status_history")
      .insert({
        application_id: id,
        from_status: current.status,
        to_status: data.status,
        actor_id: ownerId,
        reason: typeof body.reason === "string" ? body.reason.slice(0, 1000) : null
      });
    if (history.error) throw history.error;
    return apiResponse(data, request);
  });
}
