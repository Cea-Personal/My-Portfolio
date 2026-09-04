import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const stage = await client
      .schema("app")
      .from("interview_stages")
      .select("id,process_id,interview_processes!inner(owner_id)")
      .eq("id", id)
      .eq("interview_processes.owner_id", ownerId)
      .maybeSingle();
    if (!stage.data) return apiResponse(null, request, 404);
    const update = await client
      .schema("app")
      .from("interview_stages")
      .update({
        name: typeof body.name === "string" ? body.name.trim().slice(0, 200) : undefined,
        display_order: Number.isInteger(body.displayOrder) ? body.displayOrder : undefined,
        stage_type: typeof body.stageType === "string" ? body.stageType.slice(0, 80) : undefined,
        scheduled_at: typeof body.scheduledAt === "string" ? body.scheduledAt || null : undefined,
        notes: typeof body.notes === "string" ? body.notes.slice(0, 5000) : undefined,
        outcome: typeof body.outcome === "string" ? body.outcome.slice(0, 2000) : undefined
      })
      .eq("id", id)
      .select("*")
      .single();
    if (update.error) throw update.error;
    return apiResponse(update.data, request);
  });
}
