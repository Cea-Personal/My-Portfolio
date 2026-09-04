import { countBy, parseAnalyticsFilters, suppressSmallCounts } from "@/lib/analytics-filters";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    let filters;
    try {
      filters = parseAnalyticsFilters(request, ["event", "from", "to"]);
    } catch (error) {
      return apiResponse(
        { code: error instanceof Error ? error.message : "INVALID_FILTER" },
        request,
        400
      );
    }
    let query = client
      .schema("app")
      .from("analytics_events")
      .select("event_name,occurred_at,properties")
      .eq("owner_id", ownerId)
      .order("occurred_at", { ascending: false })
      .limit(5000);
    if (filters.event) query = query.eq("event_name", filters.event);
    if (filters.from) query = query.gte("occurred_at", filters.from);
    if (filters.to) query = query.lte("occurred_at", filters.to);
    const { data, error } = await query;
    if (error) throw error;
    const rawCounts = countBy((data ?? []).map((event) => event.event_name));
    return apiResponse(
      {
        totalEvents: data?.length ?? 0,
        lowData: (data ?? []).length < 5,
        metrics: suppressSmallCounts(rawCounts),
        calculationVersion: "analytics.v2",
        privacy: {
          threshold: 5,
          message:
            "Groups below five events are suppressed; URLs, queries, prompts, and free text are never accepted."
        },
        filters
      },
      request
    );
  });
}
