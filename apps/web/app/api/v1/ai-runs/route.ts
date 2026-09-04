import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("ai_runs")
      .select(
        "id,task,status,instruction_version,usage,elapsed_ms,related_type,related_id,error_code,sanitized_error,created_at,finished_at"
      )
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return apiResponse(
      {
        runs: data ?? [],
        diagnosticPolicy:
          "Inputs, outputs, prompts, secret references, and provider credentials are excluded."
      },
      request
    );
  });
}
