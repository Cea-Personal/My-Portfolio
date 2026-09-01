import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id: jobId } = await params;
    const { data: job, error: jobError } = await client
      .schema("app")
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (jobError) throw jobError;
    if (!job) return apiResponse(null, request, 404);
    const { data, error } = await client
      .schema("app")
      .from("applications")
      .upsert(
        { owner_id: ownerId, job_id: jobId, status: "draft" },
        { onConflict: "owner_id,job_id" }
      )
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("APPLICATION_CREATE_FAILED");
    return apiResponse(data, request, 201);
  });
}
