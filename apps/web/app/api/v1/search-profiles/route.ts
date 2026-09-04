import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

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
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value).filter(
    (entry): entry is [string, number] =>
      typeof entry[1] === "number" && Number.isFinite(entry[1]) && entry[1] >= 0 && entry[1] <= 1
  );
  return entries.length === Object.keys(value).length ? Object.fromEntries(entries) : null;
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
    try {
      new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    } catch {
      return apiResponse({ code: "INVALID_TIMEZONE" }, request, 400);
    }
    if (!name || scoringWeights === null)
      return apiResponse({ code: "INVALID_PROFILE" }, request, 400);
    const { data, error } = await client
      .schema("app")
      .from("job_search_profiles")
      .insert({
        owner_id: ownerId,
        name,
        target_titles: strings(body.targetTitles),
        locations: strings(body.locations),
        work_arrangements: strings(body.workArrangements),
        employment_types: strings(body.employmentTypes),
        required_technologies: strings(body.requiredTechnologies),
        preferred_technologies: strings(body.preferredTechnologies),
        excluded_technologies: strings(body.excludedTechnologies),
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
