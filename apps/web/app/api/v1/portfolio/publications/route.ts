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
    if (body.confirmation !== true || typeof body.publicationId !== "string")
      return apiResponse(
        { code: "CONFIRMATION_REQUIRED", detail: "publicationId and confirmation are required" },
        request,
        400
      );
    const { data, error } = await client
      .schema("published")
      .from("portfolio_publications")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString()
      })
      .eq("id", body.publicationId)
      .eq("owner_id", ownerId)
      .eq("status", "staged")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return apiResponse(
      data ? { status: data.status, publication: data } : null,
      request,
      data ? 201 : 409
    );
  });
}
