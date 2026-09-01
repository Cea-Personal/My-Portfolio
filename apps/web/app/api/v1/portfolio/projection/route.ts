import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("portfolio_projection_rules")
      .select("*")
      .eq("owner_id", ownerId)
      .order("display_order");
    if (error) throw error;
    return apiResponse({ rules: data ?? [], stale: false }, request);
  });
}
export async function PUT(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    if (typeof body.sourceType !== "string" || typeof body.sourceId !== "string")
      return apiResponse(
        { code: "INVALID_PROJECTION", detail: "sourceType and sourceId are required" },
        request,
        400
      );
    const { data, error } = await client
      .schema("app")
      .from("portfolio_projection_rules")
      .upsert(
        {
          owner_id: ownerId,
          source_entity_type: body.sourceType,
          source_entity_id: body.sourceId,
          public_eligible: body.publicEligible === true,
          featured: body.featured === true,
          display_order: Number.isInteger(body.displayOrder) ? body.displayOrder : 0,
          public_summary_override:
            typeof body.publicSummary === "string" ? body.publicSummary.slice(0, 2000) : null
        },
        { onConflict: "owner_id,source_entity_type,source_entity_id" }
      )
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("PROJECTION_UPDATE_FAILED");
    return apiResponse({ rule: data }, request);
  });
}
