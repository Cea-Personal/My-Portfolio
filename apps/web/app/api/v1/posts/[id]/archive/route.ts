import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (body.confirmation !== true)
      return apiResponse({ code: "CONFIRMATION_REQUIRED" }, request, 400);
    const { data, error } = await client
      .schema("app")
      .from("posts")
      .update({ status: "archived", archived_at: new Date().toISOString() })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return apiResponse(
      data ? { status: data.status, post: data } : null,
      request,
      data ? 200 : 404
    );
  });
}
