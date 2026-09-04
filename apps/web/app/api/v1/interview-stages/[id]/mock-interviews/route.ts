import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id: stageId } = await params;
    const { data: stage } = await client
      .schema("app")
      .from("interview_stages")
      .select("id, process_id")
      .eq("id", stageId)
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
    const body = await request.json().catch(() => ({}));
    const modes = [
      "recruiter",
      "technical",
      "system_design",
      "behavioral",
      "hiring_manager",
      "leadership"
    ];
    const mode = modes.includes(body.mode) ? body.mode : "behavioral";
    const { data, error } = await client
      .schema("app")
      .from("mock_interviews")
      .insert({
        stage_id: stageId,
        status: "draft",
        mode,
        questions: Array.isArray(body.questions) ? body.questions.slice(0, 50) : []
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("MOCK_INTERVIEW_CREATE_FAILED");
    return apiResponse(data, request, 201);
  });
}
