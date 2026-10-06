import { createHash } from "node:crypto";
import type { ManualOpportunityInput, NormalizedFreelanceOpportunity } from "./types";

function cleanList(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].slice(0, 80);
}

function cleanNumber(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function normalizeUrl(value: string | undefined, field: string): string | undefined {
  if (!value?.trim()) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error(`${field.toUpperCase()}_MUST_BE_URL`);
  }
  if (parsed.protocol !== "https:") throw new Error(`${field.toUpperCase()}_MUST_USE_HTTPS`);
  return parsed.toString();
}

export function normalizeManualOpportunity(input: ManualOpportunityInput): NormalizedFreelanceOpportunity {
  const title = input.title.trim().slice(0, 240);
  const description = input.description.trim().slice(0, 100_000);
  if (!title) throw new Error("FREELANCE_TITLE_REQUIRED");
  if (!description) throw new Error("FREELANCE_DESCRIPTION_REQUIRED");
  const canonicalUrl = normalizeUrl(input.url, "upwork_url");
  const hostname = canonicalUrl ? new URL(canonicalUrl).hostname.toLowerCase() : "";
  if (
    input.provider === "upwork" &&
    canonicalUrl &&
    hostname !== "upwork.com" &&
    !hostname.endsWith(".upwork.com")
  )
    throw new Error("UPWORK_URL_REQUIRED");
  const clientUrl = normalizeUrl(input.clientUrl, "client_url");
  const budgetMin = cleanNumber(input.budgetMin);
  const budgetMax = cleanNumber(input.budgetMax);
  const hourlyMin = cleanNumber(input.hourlyMin);
  const hourlyMax = cleanNumber(input.hourlyMax);
  if (budgetMin !== undefined && budgetMax !== undefined && budgetMin > budgetMax)
    throw new Error("BUDGET_RANGE_INVALID");
  if (hourlyMin !== undefined && hourlyMax !== undefined && hourlyMin > hourlyMax)
    throw new Error("HOURLY_RANGE_INVALID");

  const fingerprint = createHash("sha256")
    .update(
      [
        input.provider,
        canonicalUrl?.toLowerCase() ?? "",
        title.toLowerCase(),
        description.toLowerCase()
      ].join("|")
    )
    .digest("hex");

  const warnings: string[] = [];
  if (!canonicalUrl) warnings.push("MISSING_UPWORK_URL");
  if (budgetMin === undefined && budgetMax === undefined && hourlyMin === undefined && hourlyMax === undefined)
    warnings.push("BUDGET_UNKNOWN");
  if (!input.clientName?.trim()) warnings.push("CLIENT_UNKNOWN");
  if (!input.duration?.trim()) warnings.push("DURATION_UNKNOWN");

  return {
    provider: input.provider,
    importMode: "manual",
    title,
    description,
    ...(canonicalUrl ? { canonicalUrl } : {}),
    ...(input.clientName?.trim() ? { clientName: input.clientName.trim().slice(0, 240) } : {}),
    ...(clientUrl ? { clientUrl } : {}),
    ...(input.clientCountry?.trim() ? { clientCountry: input.clientCountry.trim().slice(0, 120) } : {}),
    ...(input.clientTimezone?.trim() ? { clientTimezone: input.clientTimezone.trim().slice(0, 120) } : {}),
    budgetType: input.budgetType ?? "unknown",
    ...(budgetMin !== undefined ? { budgetMin } : {}),
    ...(budgetMax !== undefined ? { budgetMax } : {}),
    ...(hourlyMin !== undefined ? { hourlyMin } : {}),
    ...(hourlyMax !== undefined ? { hourlyMax } : {}),
    ...(input.currency?.trim() ? { currency: input.currency.trim().toUpperCase().slice(0, 12) } : {}),
    ...(input.duration?.trim() ? { duration: input.duration.trim().slice(0, 120) } : {}),
    ...(input.timezoneRequirements?.trim()
      ? { timezoneRequirements: input.timezoneRequirements.trim().slice(0, 240) }
      : {}),
    skills: cleanList(input.skills),
    serviceTags: cleanList(input.serviceTags),
    ...(input.ownerNotes?.trim() ? { ownerNotes: input.ownerNotes.trim().slice(0, 10_000) } : {}),
    fingerprint,
    warnings
  };
}
