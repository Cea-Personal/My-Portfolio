import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const { data, error } = await client
      .schema("app")
      .from("interview_processes")
      .select(
        "*, applications(status,job_id,jobs(canonical_title,canonical_company,current_description)), interview_stages(*, interview_stage_history(*), preparation_kits(*), mock_interviews(*), interview_debriefs(*))"
      )
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) throw error;
    return apiResponse(
      data
        ? {
            process: data,
            stages: Array.isArray(data.interview_stages) ? data.interview_stages : [],
            confidence: data.confidence
          }
        : null,
      request,
      data ? 200 : 404
    );
  });
}
