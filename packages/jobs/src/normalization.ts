import { createHash } from "node:crypto";
export interface NormalizedJob {
  externalId?: string;
  company: string;
  title: string;
  location?: string;
  canonicalUrl?: string;
  description?: string;
  fingerprint: string;
  warnings: string[];
}
export function normalizeJob(input: {
  externalId?: string;
  company?: string;
  title?: string;
  location?: string;
  canonicalUrl?: string;
  description?: string;
}): NormalizedJob {
  const company = input.company?.trim() ?? "";
  const title = input.title?.trim() ?? "";
  const canonicalUrl = input.canonicalUrl?.trim();
  const warnings: string[] = [];
  if (!company) warnings.push("MISSING_COMPANY");
  if (!title) warnings.push("MISSING_TITLE");
  const fingerprint = createHash("sha256")
    .update(
      `${company.toLowerCase()}|${title.toLowerCase()}|${input.location?.trim().toLowerCase() ?? ""}|${input.description?.trim().toLowerCase() ?? ""}`
    )
    .digest("hex");
  return {
    ...(input.externalId?.trim() ? { externalId: input.externalId.trim() } : {}),
    company,
    title,
    fingerprint,
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    warnings,
    ...(input.location?.trim() ? { location: input.location.trim() } : {}),
    ...(canonicalUrl ? { canonicalUrl } : {})
  };
}
