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
    if (expired) return apiResponse({ code: "EXPORT_EXPIRED" }, request, 410);
    if (data.status !== "completed" || !data.object_key)
      return apiResponse({ status: data.status, code: "EXPORT_NOT_READY" }, request, 409);
    const object = await client.storage.from("private-artifact").download(data.object_key);
    if (object.error || !object.data)
      return apiResponse({ code: "EXPORT_OBJECT_UNAVAILABLE" }, request, 404);
    return new Response(await object.data.arrayBuffer(), {
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="career-os-export-${id}.json"`,
        "cache-control": "private, no-store"
      }
    });
  });
}
