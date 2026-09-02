import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (body.confirmation !== true)
      return apiResponse({ code: "CONFIRMATION_REQUIRED" }, request, 400);
    const { data: publicationId, error } = await client
      .schema("app")
      .rpc("withdraw_portfolio_publication", { target_id: id });
    if (error) throw error;
    return apiResponse(
      { status: "withdrawn", publicationId, ownerId },
      request,
      publicationId ? 200 : 409
    );
  });
}
