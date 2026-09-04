import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const current = await client
      .schema("app")
      .from("automation_runs")
      .select("revision,status")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (current.error) throw current.error;
    if (!current.data || !["pending", "running"].includes(current.data.status))
      return apiResponse(null, request, 409);
    const { data, error } = await client
      .schema("app")
      .from("automation_runs")
      .update({
        status: "cancelled",
        cancellation_requested_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        revision: Number(current.data.revision) + 1
      })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .in("status", ["pending", "running"])
      .eq("revision", current.data.revision)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return apiResponse(data ? { status: data.status, run: data } : null, request, data ? 200 : 409);
  });
}
