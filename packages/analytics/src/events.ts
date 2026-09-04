const propertySchemas: Record<string, Record<string, RegExp>> = {
  page_view: { page: /^(home|blog|project)$/ },
  section_view: { section: /^(about|experience|projects|ask-basil|blog|contact)$/ },
  project_view: { project: /^[a-z0-9][a-z0-9-]{0,79}$/ },
  article_view: { article: /^[a-z0-9][a-z0-9-]{0,79}$/ },
  ai_conversation_started: {},
  jd_analysis: { outcome: /^(completed|abstained|failed)$/ },
  skill_query: { skill: /^[a-z0-9+#.][a-z0-9+#. -]{0,39}$/i },
  project_interest: { project: /^[a-z0-9][a-z0-9-]{0,79}$/ }
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
    if (!rule || typeof value !== "string" || !rule.test(value))
      throw new Error("EVENT_PROPERTY_NOT_ALLOWED");
    safe[key] = value;
  }
  return {
    name,
    properties: safe,
    schemaVersion: "analytics.v1",
    occurredAt: new Date().toISOString()
  };
}
