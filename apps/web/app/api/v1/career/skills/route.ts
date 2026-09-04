import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("skills")
      .select("*")
      .eq("owner_id", ownerId)
      .order("name");
    if (error) throw error;
    return apiResponse(data ?? [], request);
  });
}
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    if (typeof body.name !== "string") return apiResponse({ code: "INVALID_SKILL" }, request, 400);
    const { data, error } = await client
      .schema("app")
      .from("skills")
      .insert({
        owner_id: ownerId,
        name: body.name.slice(0, 160),
        category: typeof body.category === "string" ? body.category.slice(0, 120) : null,
        description: typeof body.description === "string" ? body.description.slice(0, 2000) : null,
        self_assessment: ["possessed", "learning", "not_possessed"].includes(body.selfAssessment)
          ? body.selfAssessment
          : "possessed",
        visibility: "private"
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("SKILL_CREATE_FAILED");
    return apiResponse(data, request, 201);
  });
}
