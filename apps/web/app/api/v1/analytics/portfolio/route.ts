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
      .select("session_id,event_name,occurred_at,properties")
      .eq("owner_id", ownerId)
      .order("occurred_at", { ascending: false })
      .limit(5000);
    if (filters.event) query = query.eq("event_name", filters.event);
    if (filters.from) query = query.gte("occurred_at", filters.from);
    if (filters.to) query = query.lte("occurred_at", filters.to);
    const { data, error } = await query;
    if (error) throw error;
    const events = data ?? [];
    const rawCounts = countBy(events.map((event) => event.event_name));
    const propertyCounts = (eventName: string, property: string) =>
      countBy(
        events.flatMap((event) => {
          const value = event.event_name === eventName ? event.properties?.[property] : null;
          return typeof value === "string" && value ? [value] : [];
        })
      );
    const engagement = (scope: "page" | "section") => {
      const grouped = new Map<string, number[]>();
      for (const event of events) {
        if (event.event_name !== `${scope}_engagement`) continue;
        const name = event.properties?.[scope];
        const duration = event.properties?.duration_seconds;
        if (typeof name !== "string" || typeof duration !== "number") continue;
        grouped.set(name, [...(grouped.get(name) ?? []), duration]);
      }
      return Object.fromEntries(
        [...grouped].map(([name, durations]) => {
          const lowVolume = durations.length < 5;
          const total = durations.reduce((sum, duration) => sum + duration, 0);
          return [
            name,
            {
              samples: lowVolume ? null : durations.length,
              totalSeconds: lowVolume ? null : Math.round(total),
              averageSeconds: lowVolume ? null : Math.round(total / durations.length),
              lowVolume
            }
          ];
        })
      );
    };
    const uniqueVisitors = new Set(
      events.flatMap((event) => (event.session_id ? [event.session_id] : []))
    ).size;
    return apiResponse(
      {
        totalEvents: events.length,
        visitors: uniqueVisitors < 5 ? null : uniqueVisitors,
        lowData: events.length < 5,
        metrics: suppressSmallCounts(rawCounts),
        breakdowns: {
          sources: suppressSmallCounts(propertyCounts("page_view", "source")),
          countries: suppressSmallCounts(propertyCounts("page_view", "country")),
          pages: suppressSmallCounts(propertyCounts("page_view", "page")),
          sections: suppressSmallCounts(propertyCounts("section_view", "section"))
        },
        engagement: { pages: engagement("page"), sections: engagement("section") },
        calculationVersion: "analytics.v3",
        privacy: {
          threshold: 5,
          message:
            "Anonymous visitors consent before measurement. Groups below five samples are suppressed; raw IP addresses, full URLs, queries, prompts, and free text are never stored."
        },
        filters
      },
      request
    );
  });
}
