import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { data: owned } = await client
      .schema("app")
      .from("mock_interviews")
      .select("id, stage_id")
      .eq("id", id)
      .maybeSingle();
    if (!owned) return apiResponse(null, request, 404);
    const { data: stage } = await client
      .schema("app")
      .from("interview_stages")
      .select("process_id")
      .eq("id", owned.stage_id)
      .maybeSingle();
    const { data: process } = stage
      ? await client
          .schema("app")
          .from("interview_processes")
          .select("id")
          .eq("id", stage.process_id)
          .eq("owner_id", ownerId)
          .maybeSingle()
      : { data: null };
    if (!process) return apiResponse(null, request, 404);
    const { data, error } = await client
      .schema("app")
      .from("mock_interviews")
      .update({
        status: "completed",
        notes: typeof body.notes === "string" ? body.notes.slice(0, 20000) : null,
        responses: Array.isArray(body.responses) ? body.responses.slice(0, 100) : [],
        feedback: {
          technicalAccuracy: body.feedback?.technicalAccuracy ?? null,
          structure: body.feedback?.structure ?? null,
          evidenceUse: body.feedback?.evidenceUse ?? null,
          clarity: body.feedback?.clarity ?? null,
          conciseness: body.feedback?.conciseness ?? null,
          strengths: Array.isArray(body.feedback?.strengths)
            ? body.feedback.strengths.slice(0, 20)
            : [],
          improvementAreas: Array.isArray(body.feedback?.improvementAreas)
            ? body.feedback.improvementAreas.slice(0, 20)
            : [],
          disclaimer: "Qualitative preparation feedback; not a scientific score."
        },
        completed_at: new Date().toISOString()
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("MOCK_INTERVIEW_COMPLETE_FAILED");
    return apiResponse(data, request);
  });
}
