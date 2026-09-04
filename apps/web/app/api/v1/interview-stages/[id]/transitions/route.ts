import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const allowed = ["proposed", "planned", "scheduled", "completed", "cancelled", "skipped"];
    if (!allowed.includes(body.status))
      return apiResponse({ code: "INVALID_STAGE_STATUS" }, request, 400);
    const { data: stage } = await client
      .schema("app")
      .from("interview_stages")
      .select("id, process_id, status")
      .eq("id", id)
      .maybeSingle();
    if (!stage) return apiResponse(null, request, 404);
    const { data: process } = await client
      .schema("app")
      .from("interview_processes")
      .select("id")
      .eq("id", stage.process_id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (!process) return apiResponse(null, request, 404);
    if (stage.status === "completed" && body.status !== "completed")
      return apiResponse({ code: "COMPLETED_STAGE_IMMUTABLE" }, request, 409);
    const { data, error } = await client
      .schema("app")
      .from("interview_stages")
      .update({
        status: body.status,
        completed_at: body.status === "completed" ? new Date().toISOString() : null,
        preparation_state:
          typeof body.preparationState === "string"
            ? body.preparationState.slice(0, 80)
            : undefined,
        outcome: typeof body.outcome === "string" ? body.outcome.slice(0, 2000) : undefined
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("INTERVIEW_STAGE_TRANSITION_FAILED");
    const history = await client
      .schema("app")
      .from("interview_stage_history")
      .insert({
        stage_id: id,
        from_status: stage.status,
        to_status: body.status,
        reason: typeof body.reason === "string" ? body.reason.slice(0, 1000) : null
      });
    if (history.error) throw history.error;
    return apiResponse(data, request);
  });
}
