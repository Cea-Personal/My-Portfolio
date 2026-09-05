import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("published")
      .from("portfolio_publications")
      .select("*, portfolio_items(*)")
      .eq("owner_id", ownerId)
      .order("version", { ascending: false });
    if (error) throw error;
    return apiResponse(data ?? [], request);
  });
}
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    if (body.confirmation !== true)
      return apiResponse(
        { code: "CONFIRMATION_REQUIRED", detail: "An explicit confirmation is required" },
        request,
        400
      );
    const action = typeof body.action === "string" ? body.action : "activate";
    if (action === "stage") {
      const { data: publicationId, error } = await client
        .schema("app")
        .rpc("stage_portfolio_publication");
      if (error) throw error;
      const synthesis = await client
        .schema("app")
        .rpc("stage_career_brain_items", { target_publication_id: publicationId });
      if (synthesis.error) throw synthesis.error;
      const education = await client
        .schema("app")
        .rpc("stage_career_brain_education_items", { target_publication_id: publicationId });
      if (education.error) throw education.error;
      return apiResponse({ status: "staged", publicationId }, request, 201);
    }
    if (!["activate", "rollback"].includes(action) || typeof body.publicationId !== "string")
      return apiResponse({ code: "INVALID_PUBLICATION_ACTION" }, request, 400);
    const { data: publicationId, error } = await client
      .schema("app")
      .rpc("activate_portfolio_publication", { target_id: body.publicationId });
    if (error) throw error;
    const { data: publication, error: readError } = await client
      .schema("published")
      .from("portfolio_publications")
      .select("*")
      .eq("id", publicationId)
      .eq("owner_id", ownerId)
      .single();
    if (readError) throw readError;
    return apiResponse({ status: "published", publication }, request, 201);
  });
}
