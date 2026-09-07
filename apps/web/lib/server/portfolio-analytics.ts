export interface AnalyticsEventRow {
  session_id: string | null;
  event_name: string;
  occurred_at: string;
  properties: Record<string, unknown> | null;
}

interface VisitAccumulator {
  startedAt: string;
  lastSeenAt: string;
  pages: Set<string>;
  sections: Set<string>;
  pageTimeSeconds: Record<string, number>;
  sectionTimeSeconds: Record<string, number>;
  measuredEngagementSeconds: number;
}

export interface PortfolioVisit {
  startedAt: string;
  lastSeenAt: string;
  durationSeconds: number;
  measuredEngagementSeconds: number;
  pages: string[];
  sections: string[];
  pageTimeSeconds: Record<string, number>;
  sectionTimeSeconds: Record<string, number>;
}

export function isPortfolioEvent(event: AnalyticsEventRow): boolean {
  if (
    event.event_name !== "page_view" &&
    event.event_name !== "page_engagement" &&
    event.event_name !== "section_view" &&
    event.event_name !== "section_engagement"
  ) {
    return false;
  }
  const page = event.properties?.page;
  return typeof page !== "string" || page === "home" || event.event_name.startsWith("section_");
}

export function engagement(events: AnalyticsEventRow[], scope: "page" | "section") {
  const grouped = new Map<string, number[]>();
  for (const event of events) {
    if (event.event_name !== `${scope}_engagement`) continue;
    const name = event.properties?.[scope];
    const duration = event.properties?.duration_seconds;
    if (typeof name !== "string" || typeof duration !== "number") continue;
    if (!Number.isFinite(duration) || duration <= 0) continue;
    grouped.set(name, [...(grouped.get(name) ?? []), duration]);
  }
  return Object.fromEntries(
    [...grouped].map(([name, durations]) => {
      const total = durations.reduce((sum, duration) => sum + duration, 0);
      return [
        name,
        {
          samples: durations.length,
          totalSeconds: Math.round(total),
          averageSeconds: Math.round(total / durations.length)
        }
      ];
    })
  );
}

export function visitDetails(events: AnalyticsEventRow[]): PortfolioVisit[] {
  const sessions = new Map<string, VisitAccumulator>();
  for (const event of events) {
    if (!event.session_id || !isPortfolioEvent(event)) continue;
    const timestamp = Date.parse(event.occurred_at);
    if (!Number.isFinite(timestamp)) continue;
    const current = sessions.get(event.session_id) ?? {
      startedAt: event.occurred_at,
      lastSeenAt: event.occurred_at,
      pages: new Set<string>(),
      sections: new Set<string>(),
      pageTimeSeconds: {},
      sectionTimeSeconds: {},
      measuredEngagementSeconds: 0
    };
    if (Date.parse(current.startedAt) > timestamp) current.startedAt = event.occurred_at;
    if (Date.parse(current.lastSeenAt) < timestamp) current.lastSeenAt = event.occurred_at;
    const properties = event.properties ?? {};
    if (event.event_name === "page_view" && typeof properties.page === "string") {
      current.pages.add(properties.page);
    }
    if (event.event_name === "section_view" && typeof properties.section === "string") {
      current.sections.add(properties.section);
    }
    if (
      (event.event_name === "page_engagement" || event.event_name === "section_engagement") &&
      typeof properties.duration_seconds === "number" &&
      Number.isFinite(properties.duration_seconds) &&
      properties.duration_seconds > 0
    ) {
      const scope = event.event_name === "page_engagement" ? "page" : "section";
      const name = properties[scope];
      if (typeof name === "string") {
        const target = scope === "page" ? current.pageTimeSeconds : current.sectionTimeSeconds;
        target[name] = (target[name] ?? 0) + properties.duration_seconds;
        current.measuredEngagementSeconds += properties.duration_seconds;
        if (scope === "section") current.sections.add(name);
        if (scope === "page") current.pages.add(name);
      }
    }
    sessions.set(event.session_id, current);
  }
  return [...sessions.values()]
    .sort((left, right) => Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt))
    .slice(0, 250)
    .map((visit) => ({
      startedAt: visit.startedAt,
      lastSeenAt: visit.lastSeenAt,
      durationSeconds: Math.max(
        0,
        Math.round((Date.parse(visit.lastSeenAt) - Date.parse(visit.startedAt)) / 1000)
      ),
      measuredEngagementSeconds: Math.round(visit.measuredEngagementSeconds),
      pages: [...visit.pages],
      sections: [...visit.sections],
      pageTimeSeconds: Object.fromEntries(
        Object.entries(visit.pageTimeSeconds).map(([name, seconds]) => [name, Math.round(seconds)])
      ),
      sectionTimeSeconds: Object.fromEntries(
        Object.entries(visit.sectionTimeSeconds).map(([name, seconds]) => [
          name,
          Math.round(seconds)
        ])
      )
    }));
}
