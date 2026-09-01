const allowed = new Set([
  "page_view",
  "section_view",
  "project_view",
  "article_view",
  "ai_conversation_started",
  "jd_analysis",
  "skill_query",
  "project_interest"
]);
export function createPublicEvent(
  name: string,
  properties: Record<string, string | number | boolean> = {}
) {
  if (!allowed.has(name)) throw new Error("EVENT_NOT_ALLOWED");
  const safe = Object.fromEntries(
    Object.entries(properties).filter(
      ([key]) =>
        /^[a-z][a-z0-9_]{0,31}$/.test(key) && !/url|query|text|content|prompt|answer/i.test(key)
    )
  );
  return {
    name,
    properties: safe,
    schemaVersion: "analytics.v1",
    occurredAt: new Date().toISOString()
  };
}
