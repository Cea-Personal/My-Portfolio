import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const { data, error } = await client
      .schema("app")
      .from("jobs")
      .select("*")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) throw error;
    return apiResponse(data ? { job: data } : null, request, data ? 200 : 404);
  });
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const allowedStatus = [
      "discovered",
      "reviewing",
      "interested",
      "applied",
      "archived",
      "closed"
    ];
    const { data, error } = await client
      .schema("app")
      .from("jobs")
      .update({ status: allowedStatus.includes(body.status) ? body.status : undefined })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return apiResponse(data, request, data ? 200 : 404);
  });
}
