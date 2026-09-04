import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { isValidTimeZone, nextCronOccurrence, parseCronExpression } from "@/lib/automation-cron";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { data: current, error: currentError } = await client
      .schema("app")
      .from("automation_schedules")
      .select("id,cron_expression,timezone,next_run_at")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) return apiResponse(null, request, 404);
    const cronExpression =
      typeof body.cronExpression === "string"
        ? body.cronExpression.trim()
        : current.cron_expression;
    const timezone = typeof body.timezone === "string" ? body.timezone : current.timezone;
    if (!parseCronExpression(cronExpression))
      return apiResponse({ code: "INVALID_CRON_SCHEDULE" }, request, 400);
    if (!isValidTimeZone(timezone)) return apiResponse({ code: "INVALID_TIMEZONE" }, request, 400);
    if (
      body.nextRunAt !== undefined &&
      (typeof body.nextRunAt !== "string" || !Number.isFinite(Date.parse(body.nextRunAt)))
    )
      return apiResponse({ code: "INVALID_NEXT_RUN" }, request, 400);
    const { data, error } = await client
      .schema("app")
      .from("automation_schedules")
      .update({
        enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
        recurrence: "cron",
        cron_expression:
          typeof body.cronExpression === "string" ? cronExpression.slice(0, 120) : undefined,
        timezone: typeof body.timezone === "string" ? timezone : undefined,
        next_run_at:
          typeof body.nextRunAt === "string"
            ? body.nextRunAt
            : body.enabled === true ||
                body.cronExpression !== undefined ||
                body.timezone !== undefined
              ? nextCronOccurrence(cronExpression, timezone)?.toISOString()
              : undefined
      })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return apiResponse(data, request, data ? 200 : 404);
  });
}
