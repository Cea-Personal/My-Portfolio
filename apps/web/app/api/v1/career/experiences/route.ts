import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("career_experiences")
      .select("*")
      .eq("owner_id", ownerId)
      .order("display_order");
    if (error) throw error;
    return apiResponse(data ?? [], request);
  });
}
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    if (typeof body.roleTitle !== "string")
      return apiResponse({ code: "INVALID_EXPERIENCE" }, request, 400);
    const { data, error } = await client
      .schema("app")
      .from("career_experiences")
      .insert({
        owner_id: ownerId,
        role_title: body.roleTitle.slice(0, 240),
        career_stage: typeof body.careerStage === "string" ? body.careerStage : null,
        private_summary: typeof body.summary === "string" ? body.summary.slice(0, 10000) : null,
        visibility: "private"
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("EXPERIENCE_CREATE_FAILED");
    return apiResponse(data, request, 201);
  });
}
