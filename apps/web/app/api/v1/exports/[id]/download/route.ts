import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const { data, error } = await client
      .schema("app")
      .from("export_requests")
      .select("status, object_key, expires_at")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return apiResponse(null, request, 404);
    const expired = data.expires_at ? new Date(data.expires_at).getTime() <= Date.now() : true;
    return apiResponse(
      { downloadUrl: null, status: expired ? "expired" : data.status },
      request,
      expired ? 410 : 200
    );
  });
}
