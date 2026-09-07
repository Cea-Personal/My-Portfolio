import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

// Search profiles are driven by explicit criteria. Opportunity scores still
// need a stable baseline for ranking, so the system owns these defaults rather
// than asking the user to tune opaque factor weights.
const DEFAULT_SCORING_WEIGHTS = {
  alignment: 0.4,
  growth: 0.25,
  compensation: 0.2,
  logistics: 0.15
} as const;

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, 100))
        .filter(Boolean)
        .slice(0, 50)
    : [];
}

function weights(value: unknown): Record<string, number> | null {
  if (value === undefined) return { ...DEFAULT_SCORING_WEIGHTS };
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value).filter(
    (entry): entry is [string, number] =>
      typeof entry[1] === "number" && Number.isFinite(entry[1]) && entry[1] >= 0 && entry[1] <= 1
  );
  return entries.length === Object.keys(value).length ? Object.fromEntries(entries) : null;
}

function optionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("job_search_profiles")
      .select("*")
      .eq("owner_id", ownerId)
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return apiResponse({ profiles: data ?? [] }, request);
  });
}
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 160) : "";
    const scoringWeights = weights(body.scoringWeights);
    const timezone =
      typeof body.timezone === "string" ? body.timezone.trim().slice(0, 80) : "Africa/Kigali";
    const minimumSalary = optionalNumber(body.minimumSalary);
    const preferredSalary = optionalNumber(body.preferredSalary);
    const maxJobAgeDays = Number(body.maxJobAgeDays ?? 30);
    try {
      new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    } catch {
      return apiResponse({ code: "INVALID_TIMEZONE" }, request, 400);
    }
    if (
      !name ||
      scoringWeights === null ||
      Number.isNaN(minimumSalary) ||
      Number.isNaN(preferredSalary) ||
      !Number.isInteger(maxJobAgeDays) ||
      maxJobAgeDays < 1 ||
      maxJobAgeDays > 365
    )
      return apiResponse({ code: "INVALID_PROFILE" }, request, 400);
    const { data, error } = await client
      .schema("app")
      .from("job_search_profiles")
      .insert({
        owner_id: ownerId,
        name,
        target_titles: strings(body.targetTitles),
        seniority_levels: strings(body.seniorityLevels),
        locations: strings(body.locations),
        work_arrangements: strings(body.workArrangements),
        employment_types: strings(body.employmentTypes),
        required_technologies: strings(body.requiredTechnologies),
        excluded_technologies: strings(body.excludedTechnologies),
        industries: strings(body.industries),
        company_sizes: strings(body.companySizes),
        excluded_companies: strings(body.excludedCompanies),
        visa_sponsorship:
          typeof body.visaSponsorship === "string" ? body.visaSponsorship.slice(0, 80) : null,
        relocation_support:
          typeof body.relocationSupport === "string" ? body.relocationSupport.slice(0, 80) : null,
        language_requirements: strings(body.languageRequirements),
        minimum_salary: minimumSalary,
        preferred_salary: preferredSalary,
        salary_currency:
          typeof body.salaryCurrency === "string"
            ? body.salaryCurrency.trim().toUpperCase().slice(0, 3) || null
            : null,
        max_job_age_days: maxJobAgeDays,
        scoring_weights: scoringWeights,
        timezone,
        enabled: body.enabled === true
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("PROFILE_CREATE_FAILED");
    return apiResponse({ profile: data }, request, 201);
  });
}
