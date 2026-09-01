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
    const { data, error } = await client
      .schema("app")
      .from("preparation_kits")
      .insert({
        stage_id: stageId,
        schema_version: "preparation-kit.v1",
        payload: { status: "pending" }
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("PREPARATION_KIT_CREATE_FAILED");
    return apiResponse({ status: "pending", kit: data }, request, 202);
  });
}
