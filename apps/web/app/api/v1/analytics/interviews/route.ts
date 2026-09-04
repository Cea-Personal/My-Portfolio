import { countBy, parseAnalyticsFilters } from "@/lib/analytics-filters";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
interface Debrief {
  topics: string[];
  successes: string[];
  difficulties: string[];
  insight_status: string;
}
interface Stage {
  stage_type: string;
  status: string;
  outcome: string | null;
  interview_debriefs?: Debrief[];
}
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    let filters;
    try {
      filters = parseAnalyticsFilters(request, ["from", "to"]);
    } catch (error) {
      return apiResponse(
        { code: error instanceof Error ? error.message : "INVALID_FILTER" },
        request,
        400
      );
    }
    let query = client
      .schema("app")
      .from("interview_processes")
      .select(
        "id,confidence,created_at,interview_stages(stage_type,status,outcome,interview_debriefs(topics,successes,difficulties,insight_status))"
      )
      .eq("owner_id", ownerId)
      .limit(2000);
    if (filters.from) query = query.gte("created_at", filters.from);
    if (filters.to) query = query.lte("created_at", filters.to);
    const { data, error } = await query;
    if (error) throw error;
    const stages = (data ?? []).flatMap(
      (process) => (process.interview_stages ?? []) as unknown as Stage[]
    );
    const approvedDebriefs = stages
      .flatMap((stage) => stage.interview_debriefs ?? [])
      .filter((debrief) => debrief.insight_status === "approved");
    const topics = approvedDebriefs.flatMap((debrief) => debrief.topics ?? []);
    const strengths = approvedDebriefs.flatMap((debrief) => debrief.successes ?? []);
    const gaps = approvedDebriefs.flatMap((debrief) => debrief.difficulties ?? []);
    const completed = stages.filter((stage) => stage.status === "completed").length;
    const lowData = stages.length < 3;
    return apiResponse(
      {
        totals: {
          processes: data?.length ?? 0,
          stages: stages.length,
          completed,
          conversionRate: lowData ? null : completed / stages.length
        },
        stageTypes: countBy(stages.map((stage) => stage.stage_type)),
        outcomes: countBy(stages.map((stage) => stage.outcome ?? "not_recorded")),
        recurringTopics: countBy(topics),
        strengths: countBy(strengths),
        gaps: countBy(gaps),
        lowData,
        recommendations: [...new Set(gaps)]
          .slice(0, 8)
          .map((gap) => `Practise and document a stronger example for ${gap}.`),
        calculationVersion: "analytics.v2",
        filters
      },
      request
    );
  });
}
