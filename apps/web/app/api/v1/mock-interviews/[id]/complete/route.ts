import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
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
      .update({ status: "completed" })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("MOCK_INTERVIEW_COMPLETE_FAILED");
    return apiResponse(data, request);
  });
}
