import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sourceType: string; sourceId: string }> }
) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { sourceType, sourceId } = await params;
    const { data, error } = await client
      .schema("app")
      .from("portfolio_projection_rules")
      .delete()
      .eq("owner_id", ownerId)
      .eq("source_entity_type", sourceType)
      .eq("source_entity_id", sourceId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return apiResponse({ removed: Boolean(data) }, request, data ? 200 : 404);
  });
}
