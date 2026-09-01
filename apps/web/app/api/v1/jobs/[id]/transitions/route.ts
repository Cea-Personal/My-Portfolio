import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const allowed = ["discovered", "reviewing", "interested", "applied", "archived", "closed"];
    if (!allowed.includes(body.status))
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
    const { data, error } = await client
      .schema("app")
      .from("jobs")
      .update({ status: body.status })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("JOB_TRANSITION_FAILED");
    await client
      .schema("app")
      .from("job_status_history")
      .insert({
        job_id: id,
        from_status: current.status,
        to_status: body.status,
        actor_id: ownerId,
        reason: typeof body.reason === "string" ? body.reason.slice(0, 1000) : null
      });
    return apiResponse({ transitioned: true, job: data }, request);
  });
}
