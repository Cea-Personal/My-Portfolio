import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const { data, error } = await client
      .schema("app")
      .from("automation_runs")
      .select(
        "id,workflow_name,workflow_version,status,correlation_id,started_at,finished_at,error_code,created_at,automation_run_steps(id,step_name,step_version,operation_key,status,attempt_count,started_at,finished_at,error_code)"
      )
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) throw error;
    return apiResponse(data, request, data ? 200 : 404);
  });
}
