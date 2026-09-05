import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client }) => {
    const body = await request.json().catch(() => ({}));
    if (body.confirmation !== true)
      return apiResponse({ code: "CONFIRMATION_REQUIRED" }, request, 400);
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
    const { data: publication, error: publicationError } = await client
      .schema("published")
      .from("portfolio_publications")
      .select("*,portfolio_items(*),public_evidence(*)")
      .eq("id", publicationId)
      .single();
    if (publicationError) throw publicationError;
    return apiResponse(publication, request, 202);
  });
}
