import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("interview_processes")
      .select("confidence, created_at")
      .eq("owner_id", ownerId);
    if (error) throw error;
    return apiResponse(
      {
        metrics: {
          total: data?.length ?? 0,
          confidence: data?.map((item) => item.confidence) ?? []
        }
      },
      request
    );
  });
}
