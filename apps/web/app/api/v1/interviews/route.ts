import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("interview_processes")
      .select(
        "*, applications(status,job_id,jobs(canonical_title,canonical_company)), interview_stages(*, interview_stage_history(*), preparation_kits(*), mock_interviews(*), interview_debriefs(*))"
      )
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return apiResponse({ processes: data ?? [] }, request);
  });
}
