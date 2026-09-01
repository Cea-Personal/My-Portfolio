import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { data: current } = await client
      .schema("app")
      .from("applications")
      .select("status")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (!current) return apiResponse(null, request, 404);
    const { data, error } = await client
      .schema("app")
      .from("applications")
      .update({ status: typeof body.status === "string" ? body.status : "in_progress" })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("APPLICATION_TRANSITION_FAILED");
    await client
      .schema("app")
      .from("application_status_history")
      .insert({
        application_id: id,
        from_status: current.status,
        to_status: data.status,
        actor_id: ownerId,
        reason: typeof body.reason === "string" ? body.reason.slice(0, 1000) : null
      });
    return apiResponse(data, request);
  });
}
