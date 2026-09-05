export const CAREER_FACT_TYPES = [
  "experience",
  "project",
  "skill",
  "education",
  "certification"
] as const;

export type CareerFactType = (typeof CAREER_FACT_TYPES)[number];

const EXPERIENCE_DETAIL_TYPES = new Set([
  "responsibility",
  "responsibilities",
  "achievement",
  "achievements",
  "impact",
  "impacts",
  "employment",
  "work_experience"
]);

export function normalizeCareerFactType(value: unknown): CareerFactType {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (EXPERIENCE_DETAIL_TYPES.has(normalized)) return "experience";
  if (normalized === "projects") return "project";
  if (["skills", "tool", "tools", "technology", "technologies"].includes(normalized))
    return "skill";
  if (["certifications", "certificate", "certificates"].includes(normalized))
    return "certification";
  if (["educational", "academic", "degree", "degrees"].includes(normalized)) return "education";
  return CAREER_FACT_TYPES.includes(normalized as CareerFactType)
    ? (normalized as CareerFactType)
    : "project";
}

export function normalizeStructuredValue(
  factType: CareerFactType,
  value: unknown
): Record<string, unknown> {
  const source =
    value && typeof value === "object" ? { ...(value as Record<string, unknown>) } : {};
  delete source.factType;
  delete source.fact_type;
  if (factType !== "experience") return source;
  const list = (key: string) => {
    const item = source[key];
    if (Array.isArray(item))
      return item.filter((entry): entry is string => typeof entry === "string");
    return typeof item === "string" && item.trim() ? [item.trim()] : [];
  };
  return {
    ...source,
    organization: typeof source.organization === "string" ? source.organization.trim() : "",
    role: typeof source.role === "string" ? source.role.trim() : "",
    period: typeof source.period === "string" ? source.period.trim() : "",
    responsibilities: list("responsibilities"),
    achievements: list("achievements"),
    impacts: list("impacts"),
    projects: list("projects"),
    skills: list("skills"),
    tools: list("tools")
  };
}
