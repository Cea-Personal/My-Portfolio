import { countBy, parseAnalyticsFilters } from "@/lib/analytics-filters";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import {
  engagement,
  isPortfolioEvent,
  type AnalyticsEventRow,
  visitDetails
} from "@/lib/server/portfolio-analytics";

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
    const events = (data ?? []) as AnalyticsEventRow[];
    const portfolioEvents = events.filter(isPortfolioEvent);
    const totalVisits = new Set(
      portfolioEvents
        .map((event) => event.session_id)
        .filter((sessionId): sessionId is string => Boolean(sessionId))
    ).size;
    const sectionCounts = countBy(
      portfolioEvents.flatMap((event) => {
        const section = event.properties?.section;
        return event.event_name === "section_view" && typeof section === "string" ? [section] : [];
      })
    );
    const pageCounts = countBy(
      portfolioEvents.flatMap((event) => {
        const page = event.properties?.page;
        return event.event_name === "page_view" && typeof page === "string" ? [page] : [];
      })
    );
    return apiResponse(
      {
        totalEvents: portfolioEvents.length,
        totalVisits,
        metrics: countBy(portfolioEvents.map((event) => event.event_name)),
        breakdowns: { pages: pageCounts, sections: sectionCounts },
        engagement: {
          pages: engagement(portfolioEvents, "page"),
          sections: engagement(portfolioEvents, "section")
        },
        visits: visitDetails(portfolioEvents),
        calculationVersion: "analytics.v5",
        privacy: {
          message:
            "Summary and visit details contain portfolio page and section activity only. Visitor identity, location, referral source, URLs, queries, prompts, and free text are not exposed."
        },
        filters
      },
      request
    );
  });
}
