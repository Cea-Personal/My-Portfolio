import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id: processId } = await params;
    const { data: process } = await client
      .schema("app")
      .from("interview_processes")
      .select("id")
      .eq("id", processId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (!process) return apiResponse(null, request, 404);
    const body = await request.json().catch(() => ({}));
    const { data, error } = await client
      .schema("app")
      .from("interview_stages")
      .insert({
        process_id: processId,
        name: typeof body.name === "string" ? body.name.slice(0, 200) : "Unknown stage",
        display_order: Number.isInteger(body.displayOrder) ? body.displayOrder : 0,
        source: body.source === "manual" ? "owner" : "unknown",
        stage_type: typeof body.stageType === "string" ? body.stageType.slice(0, 80) : "unknown",
        scheduled_at:
          typeof body.scheduledAt === "string" && body.scheduledAt ? body.scheduledAt : null,
        notes: typeof body.notes === "string" ? body.notes.slice(0, 5000) : null,
        confidence: body.source === "manual" ? "high" : "low"
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("INTERVIEW_STAGE_CREATE_FAILED");
    const history = await client.schema("app").from("interview_stage_history").insert({
      stage_id: data.id,
      from_status: null,
      to_status: "proposed",
      reason: "stage_created"
    });
    if (history.error) throw history.error;
    return apiResponse(data, request, 201);
  });
}
