import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const { data, error } = await client
      .schema("app")
      .from("integration_connections")
      .update({ status: "revoked" })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .select("id, status, provider")
      .maybeSingle();
    if (error) throw error;
    return apiResponse(
      data ? { revoked: true, connection: data } : null,
      request,
      data ? 200 : 404
    );
  });
}
