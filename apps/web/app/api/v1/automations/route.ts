import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const [schedules, runs, deadLetters] = await Promise.all([
      client.schema("app").from("automation_schedules").select("*").eq("owner_id", ownerId),
      client
        .schema("app")
        .from("automation_runs")
        .select(
          "id,workflow_name,workflow_version,status,correlation_id,retry_count,resumed_from_id,started_at,finished_at,error_code,created_at"
        )
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false })
        .limit(200),
      client
        .schema("app")
        .from("automation_dead_letters")
        .select("id,run_id,event_name,reason,created_at,resolved_at")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false })
        .limit(100)
    ]);
    if (schedules.error) throw schedules.error;
    if (runs.error) throw runs.error;
    if (deadLetters.error) throw deadLetters.error;
    return apiResponse(
      {
        schedules: schedules.data ?? [],
        runs: runs.data ?? [],
        deadLetters: deadLetters.data ?? []
      },
      request
    );
  });
}
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    if (
      typeof body.purpose !== "string" ||
      !["drive_sync", "job_search", "analytics_aggregate"].includes(body.purpose) ||
      typeof body.recurrence !== "string" ||
      !["hourly", "daily", "weekly"].includes(body.recurrence)
    )
      return apiResponse({ code: "INVALID_AUTOMATION" }, request, 400);
    const { data, error } = await client
      .schema("app")
      .from("automation_schedules")
      .insert({
        owner_id: ownerId,
        purpose: body.purpose.slice(0, 120),
        recurrence: body.recurrence.slice(0, 120),
        timezone: typeof body.timezone === "string" ? body.timezone : "Africa/Kigali",
        enabled: false
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("AUTOMATION_CREATE_FAILED");
    return apiResponse(data, request, 201);
  });
}
