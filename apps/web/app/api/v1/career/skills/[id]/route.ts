import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (!["possessed", "learning", "not_possessed"].includes(body.selfAssessment))
      return apiResponse({ code: "INVALID_SKILL_ASSESSMENT" }, request, 400);
    const { data, error } = await client
      .schema("app")
      .from("skills")
      .update({ self_assessment: body.selfAssessment })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return apiResponse(data, request, data ? 200 : 404);
  });
}
