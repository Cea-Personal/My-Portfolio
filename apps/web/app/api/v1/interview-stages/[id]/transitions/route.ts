import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const allowed = ["proposed", "planned", "completed", "skipped"];
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
    const { data, error } = await client
      .schema("app")
      .from("interview_stages")
      .update({
        status: body.status,
        completed_at: body.status === "completed" ? new Date().toISOString() : null
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("INTERVIEW_STAGE_TRANSITION_FAILED");
    await client
      .schema("app")
      .from("interview_stage_history")
      .insert({
        stage_id: id,
        from_status: stage.status,
        to_status: body.status,
        reason: typeof body.reason === "string" ? body.reason.slice(0, 1000) : null
      });
    return apiResponse(data, request);
  });
}
