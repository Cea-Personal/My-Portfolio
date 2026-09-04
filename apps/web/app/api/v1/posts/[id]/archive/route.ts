import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (body.confirmation !== true)
      return apiResponse({ code: "CONFIRMATION_REQUIRED" }, request, 400);
    const owned = await client
      .schema("app")
      .from("posts")
      .select("id")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (owned.error) throw owned.error;
    if (!owned.data) return apiResponse(null, request, 404);
    const { data, error } = await client.schema("app").rpc("archive_post", { target_id: id });
    if (error) throw error;
    return apiResponse({ status: "archived", postId: data }, request);
  });
}
