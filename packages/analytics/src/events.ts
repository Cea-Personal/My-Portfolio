const sections = /^(about|experience|projects|ask-basil|blog|contact)$/;
const pages = /^(home|blog|project)$/;
const propertySchemas: Record<
  string,
  Record<string, (value: string | number | boolean) => boolean>
> = {
  page_view: {
    page: (value) => typeof value === "string" && pages.test(value),
    source: (value) =>
      typeof value === "string" &&
      /^(direct|internal|google|bing|linkedin|github|other)$/.test(value),
    country: (value) => typeof value === "string" && /^(unknown|[A-Z]{2})$/.test(value)
  },
  section_view: { section: (value) => typeof value === "string" && sections.test(value) },
  section_engagement: {
    section: (value) => typeof value === "string" && sections.test(value),
    duration_seconds: (value) => typeof value === "number" && value >= 1 && value <= 1800
  },
  page_engagement: {
    page: (value) => typeof value === "string" && pages.test(value),
    duration_seconds: (value) => typeof value === "number" && value >= 1 && value <= 1800
  },
  project_view: {
    project: (value) => typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,79}$/.test(value)
  },
  article_view: {
    article: (value) => typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,79}$/.test(value)
  },
  ai_conversation_started: {},
  jd_analysis: {
    outcome: (value) => typeof value === "string" && /^(completed|abstained|failed)$/.test(value)
  },
  skill_query: {
    skill: (value) => typeof value === "string" && /^[a-z0-9+#.][a-z0-9+#. -]{0,39}$/i.test(value)
  },
  project_interest: {
    project: (value) => typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,79}$/.test(value)
  }
};
export function createPublicEvent(
  name: string,
  properties: Record<string, string | number | boolean> = {}
) {
  const schema = propertySchemas[name];
  if (!schema) throw new Error("EVENT_NOT_ALLOWED");
  const safe: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(properties)) {
    const rule = schema[key];
    if (!rule || !rule(value)) throw new Error("EVENT_PROPERTY_NOT_ALLOWED");
    safe[key] = value;
  }
  return {
    name,
    properties: safe,
    schemaVersion: "analytics.v3",
    occurredAt: new Date().toISOString()
  };
}
