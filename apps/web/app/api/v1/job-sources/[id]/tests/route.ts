import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const { data, error } = await client
      .schema("app")
      .from("job_sources")
      .select("id")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) throw error;
    return apiResponse(
      { healthy: Boolean(data), testedAt: new Date().toISOString() },
      request,
      data ? 200 : 404
    );
  });
}
