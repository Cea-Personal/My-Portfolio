import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectKey: string; mediaId: string }> }
) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { projectKey, mediaId } = await params;
    const current = await client
      .schema("app")
      .from("portfolio_project_media")
      .select("id,project_key,status")
      .eq("id", mediaId)
      .eq("owner_id", ownerId)
      .eq("project_key", projectKey)
      .maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return apiResponse({ code: "PROJECT_MEDIA_NOT_FOUND" }, request, 404);
    const stale = await client
      .schema("app")
      .from("portfolio_project_media")
      .update({ status: "superseded", superseded_at: new Date().toISOString() })
      .eq("owner_id", ownerId)
      .eq("project_key", projectKey)
      .eq("media_type", "cover_image")
      .eq("status", "approved")
      .neq("id", mediaId);
    if (stale.error) throw stale.error;
    const approved = await client
      .schema("app")
      .from("portfolio_project_media")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", mediaId)
      .eq("owner_id", ownerId)
      .eq("project_key", projectKey)
      .select(
        "id,project_key,media_type,source_type,status,public_url,alt_text,prompt,provider,model,model_version,created_at,approved_at"
      )
      .single();
    if (approved.error || !approved.data) throw approved.error ?? new Error("PROJECT_MEDIA_APPROVAL_FAILED");
    return apiResponse({ media: approved.data }, request);
  });
}
