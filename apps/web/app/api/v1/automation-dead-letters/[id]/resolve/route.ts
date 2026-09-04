import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (typeof body.note !== "string" || !body.note.trim())
      return apiResponse({ code: "RESOLUTION_NOTE_REQUIRED" }, request, 400);
    const { data, error } = await client
      .schema("app")
      .from("automation_dead_letters")
      .update({
        resolved_at: new Date().toISOString(),
        resolution_note: body.note.trim().slice(0, 500)
      })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .is("resolved_at", null)
      .select("id,resolved_at,resolution_note")
      .maybeSingle();
    if (error) throw error;
    return apiResponse(data, request, data ? 200 : 409);
  });
}
