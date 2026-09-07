import type { JobSourceInput } from "./registry";

export function bearerSecret(input: JobSourceInput): string | undefined {
  const value = input.headers?.authorization ?? input.headers?.Authorization;
  if (!value) return undefined;
  return value.replace(/^Bearer\s+/i, "").trim() || undefined;
}

export function profileQuery(input: JobSourceInput, key: string): string[] {
  const value = input.query?.[key];
  return typeof value === "string"
    ? value.split(",").map((item) => item.trim()).filter(Boolean)
    : [];
}

export function searchText(input: JobSourceInput): string {
  return [
    ...profileQuery(input, "title"),
    ...profileQuery(input, "preferredTitle"),
    ...profileQuery(input, "technology"),
    ...profileQuery(input, "preferredTechnology")
  ].join(" ").trim();
}

export function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

export function nestedText(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!Array.isArray(value)) return undefined;
  const text = value
    .flatMap((item) => {
      if (typeof item === "string") return [item];
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return [firstString(record, ["text", "description", "content", "name"]) ?? ""];
      }
      return [];
    })
    .filter(Boolean)
    .join("\n");
  return text || undefined;
}

export function normalizedRecord(record: Record<string, unknown>) {
  const title = firstString(record, ["title", "position", "job_title", "jobTitle", "name"]);
  const company = firstString(record, [
    "company",
    "company_name",
    "employer_name",
    "companyName",
    "organization"
  ]);
  const location = firstString(record, [
    "location",
    "job_location",
    "short_location",
    "long_location",
    "where"
  ]);
  const canonicalUrl = firstString(record, [
    "canonicalUrl",
    "url",
    "source_url",
    "apply_link",
    "job_apply_link",
    "link",
    "final_url"
  ]);
  const description =
    firstString(record, [
      "description",
      "job_description",
      "jobDescription",
      "summary",
      "content",
      "snippet"
    ]) ??
    nestedText(record.job_highlights) ??
    nestedText(record.responsibilities) ??
    nestedText(record.requirements) ??
    nestedText(record.qualifications);
  const externalId = firstString(record, ["id", "job_id", "external_id", "slug"]);
  return {
    ...(externalId ? { externalId } : {}),
    ...(company ? { company } : {}),
    ...(title ? { title } : {}),
    ...(location ? { location } : {}),
    ...(canonicalUrl ? { canonicalUrl } : {}),
    ...(description ? { description } : {})
  };
}

export function recordsFromPayload(payload: unknown, keys = ["jobs", "data", "results", "jobs_results"]): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  if (!payload || typeof payload !== "object") return [];
  const value = payload as Record<string, unknown>;
  for (const key of keys) {
    if (Array.isArray(value[key]))
      return (value[key] as unknown[]).filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  }
  return [];
}
