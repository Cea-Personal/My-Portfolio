import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id: stageId } = await params;
    const body = await request.json().catch(() => ({}));
    const stage = await client
      .schema("app")
      .from("interview_stages")
      .select("id,interview_processes!inner(owner_id)")
      .eq("id", stageId)
      .eq("interview_processes.owner_id", ownerId)
      .maybeSingle();
    if (!stage.data) return apiResponse(null, request, 404);
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 30000) : "";
    if (!notes) return apiResponse({ code: "DEBRIEF_NOTES_REQUIRED" }, request, 400);
    const sentences = notes
      .split(/[.!?]/)
      .map((value: string) => value.trim())
      .filter(Boolean)
      .slice(0, 30);
    const derived = sentences.map((text: string) => ({
      text,
      kind: /well|strong|success/i.test(text)
        ? "strength"
        : /difficult|weak|missed|gap/i.test(text)
          ? "gap"
          : "theme"
    }));
    const result = await client
      .schema("app")
      .from("interview_debriefs")
      .insert({
        stage_id: stageId,
        owner_id: ownerId,
        original_notes: notes,
        questions: Array.isArray(body.questions) ? body.questions.slice(0, 50) : [],
        topics: Array.isArray(body.topics) ? body.topics.slice(0, 50) : [],
        successes: Array.isArray(body.successes) ? body.successes.slice(0, 50) : [],
        difficulties: Array.isArray(body.difficulties) ? body.difficulties.slice(0, 50) : [],
        follow_ups: Array.isArray(body.followUps) ? body.followUps.slice(0, 50) : [],
        derived_insights: derived,
        insight_status: "candidate"
      })
      .select("*")
      .single();
    if (result.error) throw result.error;
    return apiResponse({ debrief: result.data, reviewRequired: true }, request, 201);
  });
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const status = body.decision === "approved" ? "approved" : "rejected";
    const result = await client
      .schema("app")
      .from("interview_debriefs")
      .update({ insight_status: status, reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .select("*")
      .maybeSingle();
    if (result.error) throw result.error;
    return apiResponse(result.data, request, result.data ? 200 : 404);
  });
}
