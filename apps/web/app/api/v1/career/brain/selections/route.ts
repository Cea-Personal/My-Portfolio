import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

const itemTypes = new Set([
  "experience",
  "project",
  "education",
  "certification",
  "skill",
  "portfolio_summary",
  "about"
]);

export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    if (
      typeof body.itemKey !== "string" ||
      body.itemKey.length > 160 ||
      typeof body.itemType !== "string" ||
      !itemTypes.has(body.itemType) ||
      typeof body.publicEligible !== "boolean"
    )
      return apiResponse({ code: "INVALID_CAREER_BRAIN_SELECTION" }, request, 400);
    const result = await client
      .schema("app")
      .from("career_brain_public_selections")
      .upsert(
        {
          owner_id: ownerId,
          item_key: body.itemKey,
          item_type: body.itemType,
          public_eligible: body.publicEligible,
          updated_at: new Date().toISOString()
        },
        { onConflict: "owner_id,item_key" }
      )
      .select("item_key,item_type,public_eligible")
      .single();
    if (result.error) throw result.error;
    return apiResponse(result.data, request);
  });
}
