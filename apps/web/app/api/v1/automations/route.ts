import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { isValidTimeZone, nextCronOccurrence, parseCronExpression } from "@/lib/automation-cron";
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
      !["drive_sync", "job_search", "analytics_aggregate", "career_brain"].includes(body.purpose) ||
      typeof body.cronExpression !== "string" ||
      !parseCronExpression(body.cronExpression)
    )
      return apiResponse(
        {
          code: "INVALID_AUTOMATION",
          detail: "Choose a purpose and provide a valid five-field cron expression."
        },
        request,
        400
      );
    const timezone = typeof body.timezone === "string" ? body.timezone : "Africa/Kigali";
    if (!isValidTimeZone(timezone)) return apiResponse({ code: "INVALID_TIMEZONE" }, request, 400);
    let profileId: string | null = null;
    if (body.purpose === "job_search") {
      if (typeof body.profileId !== "string")
        return apiResponse({ code: "PROFILE_REQUIRED" }, request, 400);
      const profile = await client
        .schema("app")
        .from("job_search_profiles")
        .select("id")
        .eq("id", body.profileId)
        .eq("owner_id", ownerId)
        .is("archived_at", null)
        .maybeSingle();
      if (profile.error) throw profile.error;
      if (!profile.data) return apiResponse({ code: "PROFILE_NOT_FOUND" }, request, 404);
      profileId = profile.data.id;
    }
    const nextRunAt = nextCronOccurrence(body.cronExpression, timezone);
    if (!nextRunAt) return apiResponse({ code: "INVALID_CRON_SCHEDULE" }, request, 400);
    const { data, error } = await client
      .schema("app")
      .from("automation_schedules")
      .insert({
        owner_id: ownerId,
        purpose: body.purpose.slice(0, 120),
        profile_id: profileId,
        recurrence: "cron",
        cron_expression: body.cronExpression.trim().slice(0, 120),
        timezone,
        enabled: false,
        next_run_at: nextRunAt.toISOString()
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("AUTOMATION_CREATE_FAILED");
    return apiResponse(data, request, 201);
  });
}
