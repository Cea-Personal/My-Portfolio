import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const { data, error } = await client
      .schema("app")
      .from("ingestion_runs")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .in("status", ["pending", "running"])
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return apiResponse(data ? { status: data.status, run: data } : null, request, data ? 200 : 409);
  });
}
