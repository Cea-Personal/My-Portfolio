import { countBy, parseAnalyticsFilters } from "@/lib/analytics-filters";
import { withPrivateApi } from "@/lib/api/private";
import { apiResponse } from "@/lib/api/response";
import { generateReasoningJson, resolveReasoningProviders } from "@/lib/server/reasoning-provider";
import {
  engagement,
  isPortfolioEvent,
  type AnalyticsEventRow,
  visitDetails
} from "@/lib/server/portfolio-analytics";
import { EMPLOYER_PRIVACY_INSTRUCTION } from "@/lib/server/retrieval-policy";

// The insight request waits for the orchestrator and its native child agent.
// Allow enough time for that round trip while keeping the client bounded.
export const maxDuration = 180;

interface Insight {
  title: string;
  observation: string;
  implication: string;
  action: string;
  confidence: string;
}

interface InsightInput {
  totalVisits: number;
  totalEvents: number;
  eventCounts: Record<string, number>;
  pageViews: Record<string, number>;
  sectionViews: Record<string, number>;
  pageEngagement: Record<
    string,
    {
      samples: number;
      totalSeconds: number;
      averageSeconds: number;
    }
  >;
  sectionEngagement: Record<
    string,
    {
      samples: number;
      totalSeconds: number;
      averageSeconds: number;
    }
  >;
  visitDurationsSeconds: number[];
}

export async function POST(request: Request) {
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
    const startedAt = performance.now();
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
    const result = await query;
    if (result.error) throw result.error;
    const events = (result.data ?? []) as AnalyticsEventRow[];
    const portfolioEvents = events.filter(isPortfolioEvent);
    const visits = visitDetails(portfolioEvents);
    const totalVisits = new Set(
      portfolioEvents
        .map((event) => event.session_id)
        .filter((sessionId): sessionId is string => Boolean(sessionId))
    ).size;
    const input: InsightInput = {
      totalVisits,
      totalEvents: portfolioEvents.length,
      eventCounts: countBy(portfolioEvents.map((event) => event.event_name)),
      pageViews: countBy(
        portfolioEvents.flatMap((event) =>
          event.event_name === "page_view" && typeof event.properties?.page === "string"
            ? [event.properties.page]
            : []
        )
      ),
      sectionViews: countBy(
        portfolioEvents.flatMap((event) =>
          event.event_name === "section_view" && typeof event.properties?.section === "string"
            ? [event.properties.section]
            : []
        )
      ),
      pageEngagement: engagement(portfolioEvents, "page"),
      sectionEngagement: engagement(portfolioEvents, "section"),
      visitDurationsSeconds: visits.map((visit) =>
        Math.max(visit.durationSeconds, visit.measuredEngagementSeconds)
      )
    };
    try {
      const providers = await resolveReasoningProviders(client, ownerId, "portfolio_analytics");
      // Portfolio analytics is a small aggregate request. Bound each attempt
      // so a stalled native child does not block the dashboard for minutes.
      const boundedProviders = providers.map((provider) => ({
        ...provider,
        timeoutMs: Math.min(provider.timeoutMs, 45_000),
        retryLimit: 0
      }));
      const generated = await generateReasoningJson(
        boundedProviders,
        [
          "You are the public portfolio analytics subagent.",
          "Analyze only the supplied aggregate metrics.",
          EMPLOYER_PRIVACY_INSTRUCTION,
          "Return JSON with summary, insights, and nextSteps.",
          "Each insight must include title, observation, implication, action, and confidence.",
          "Limit insights to five and nextSteps to four.",
          "Do not mention or infer visitor identity, country, referral source, demographics, or intent."
        ].join(" "),
        { ...input },
        { task: "portfolio_analytics" }
      );
      const output = generated.output;
      const insights = Array.isArray(output.insights)
        ? output.insights
            .filter((item): item is Record<string, unknown> =>
              Boolean(item && typeof item === "object")
            )
            .slice(0, 5)
            .map(
              (item): Insight => ({
                title: text(item.title),
                observation: text(item.observation),
                implication: text(item.implication),
                action: text(item.action),
                confidence: text(item.confidence)
              })
            )
        : [];
      await recordAudit(client, ownerId, "portfolio_insights.generated", null, {
        insightCount: insights.length,
        elapsedMs: Math.round(performance.now() - startedAt)
      });
      return apiResponse(
        {
          summary: text(output.summary) || "The subagent did not find a strong pattern yet.",
          insights,
          nextSteps: Array.isArray(output.nextSteps)
            ? output.nextSteps
                .filter((item): item is string => typeof item === "string")
                .slice(0, 4)
            : [],
          generatedAt: new Date().toISOString(),
          filters
        },
        request
      );
    } catch (error) {
      const detail =
        error instanceof Error ? error.message.slice(0, 240) : "PORTFOLIO_INSIGHTS_FAILED";
      await recordAudit(client, ownerId, "portfolio_insights.failed", detail, {
        code: detail.split(":")[0]
      });
      const fallback = fallbackInsights(input, detail);
      return apiResponse(
        {
          ...fallback,
          generatedAt: new Date().toISOString(),
          filters,
          fallback: true,
          fallbackReason: detail
        },
        request
      );
    }
  });
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 700) : "";
}

function fallbackInsights(input: InsightInput, reason: string) {
  const sections = Object.entries(input.sectionEngagement).sort(
    ([, left], [, right]) => right.totalSeconds - left.totalSeconds
  );
  const topSection = sections[0];
  const averageVisit = input.visitDurationsSeconds.length
    ? Math.round(
        input.visitDurationsSeconds.reduce((total, seconds) => total + seconds, 0) /
          input.visitDurationsSeconds.length
      )
    : 0;
  const insights: Insight[] = [];
  if (input.totalVisits) {
    insights.push({
      title: "Portfolio activity",
      observation: `${String(input.totalVisits)} visit${input.totalVisits === 1 ? "" : "s"} generated ${String(input.totalEvents)} tracked event${input.totalEvents === 1 ? "" : "s"}.`,
      implication:
        "The current sample is enough to monitor movement, but not to claim broad audience preferences.",
      action: "Continue collecting privacy-safe visits before making major content decisions.",
      confidence: "Descriptive only"
    });
  }
  if (topSection) {
    insights.push({
      title: "Most measured attention",
      observation: `${topSection[0]} has the highest recorded section dwell time at ${String(topSection[1].totalSeconds)} seconds across ${String(topSection[1].samples)} sample${topSection[1].samples === 1 ? "" : "s"}.`,
      implication:
        "This section currently receives the strongest measured attention in the available sample.",
      action: "Keep its explanation clear and connect it to a useful next action.",
      confidence: topSection[1].samples >= 3 ? "Moderate" : "Low volume"
    });
  }
  if (averageVisit) {
    insights.push({
      title: "Visit duration",
      observation: `Measured visits average ${String(averageVisit)} seconds in the available session sample.`,
      implication:
        "Session duration is a directional engagement signal, not a measure of visitor intent.",
      action: "Compare this trend over time with section dwell rather than judging a single visit.",
      confidence: input.visitDurationsSeconds.length >= 3 ? "Moderate" : "Low volume"
    });
  }
  return {
    summary: input.totalVisits
      ? `The portfolio has ${String(input.totalVisits)} measured visit${input.totalVisits === 1 ? "" : "s"}. This readout uses the recorded aggregate activity only.`
      : "There is not enough portfolio activity yet for a meaningful pattern readout.",
    insights: insights.slice(0, 5),
    nextSteps: [
      "Verify the portfolio analytics orchestrator health to restore generated insights.",
      "Collect more visits before treating a section trend as representative."
    ],
    fallbackReason: reason
  };
}

async function recordAudit(
  client: Parameters<Parameters<typeof withPrivateApi>[1]>[0]["client"],
  ownerId: string,
  action: string,
  reason: string | null,
  metadata: Record<string, unknown>
) {
  try {
    await client.schema("app").from("audit_events").insert({
      owner_id: ownerId,
      actor_type: "owner",
      action,
      target_type: "portfolio_analytics",
      reason,
      after_metadata: metadata
    });
  } catch {
    // Analytics should still return its result if observability is unavailable.
  }
}
