const PUBLIC_STRUCTURED_FIELDS = [
  "title",
  "summary",
  "description",
  "experience",
  "projects",
  "workProjects",
  "skills",
  "technologies",
  "problem",
  "approach",
  "role",
  "outcome",
  "highlights",
  "qualification",
  "institution",
  "certifications"
] as const;

function collectText(value: unknown, output: string[], depth = 0): void {
  if (output.length >= 80 || depth > 3) return;
  if (typeof value === "string") {
    const candidate = value.trim();
    if (candidate) output.push(expandTechnologyTerms(candidate));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, output, depth + 1);
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  for (const key of PUBLIC_STRUCTURED_FIELDS) {
    if (key in record) collectText(record[key], output, depth + 1);
  }
}

/** Build bounded, public-only context from a published portfolio item. */
export function publicPortfolioItemContext(item: Record<string, unknown>): string {
  const values: string[] = [];
  for (const key of [
    "title",
    "subtitle",
    "company_name",
    "organization_name",
    "period",
    "display_metric",
    "public_summary",
    "display_technologies"
  ]) {
    collectText(item[key], values);
  }
  collectText(item.structured_content, values);
  return [...new Set(values)].join(" — ").slice(0, 12_000);
}
import { expandTechnologyTerms } from "./portfolio-career-rules";
