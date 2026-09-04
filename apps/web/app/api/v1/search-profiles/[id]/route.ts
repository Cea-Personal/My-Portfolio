import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const { data, error } = await client
      .schema("app")
      .from("job_search_profiles")
      .select("*")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .is("archived_at", null)
      .maybeSingle();
    if (error) throw error;
    return apiResponse(data ? { profile: data } : null, request, data ? 200 : 404);
  });
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const array = (value: unknown) =>
      Array.isArray(value)
        ? value
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim().slice(0, 100))
            .filter(Boolean)
            .slice(0, 50)
        : undefined;
    const scoringWeights =
      body.scoringWeights &&
      typeof body.scoringWeights === "object" &&
      !Array.isArray(body.scoringWeights)
        ? Object.fromEntries(
            Object.entries(body.scoringWeights).filter(
              (entry): entry is [string, number] =>
                typeof entry[1] === "number" &&
                Number.isFinite(entry[1]) &&
                entry[1] >= 0 &&
                entry[1] <= 1
            )
          )
        : undefined;
    if (
      scoringWeights &&
      Object.keys(scoringWeights).length !== Object.keys(body.scoringWeights as object).length
    )
      return apiResponse({ code: "INVALID_SCORING_WEIGHTS" }, request, 400);
    const timezone =
      typeof body.timezone === "string" ? body.timezone.trim().slice(0, 80) : undefined;
    if (timezone) {
      try {
        new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
      } catch {
        return apiResponse({ code: "INVALID_TIMEZONE" }, request, 400);
      }
    }
    const update = {
      name: typeof body.name === "string" ? body.name.trim().slice(0, 160) : undefined,
      target_titles: array(body.targetTitles),
      locations: array(body.locations),
      work_arrangements: array(body.workArrangements),
      employment_types: array(body.employmentTypes),
      required_technologies: array(body.requiredTechnologies),
      preferred_technologies: array(body.preferredTechnologies),
      excluded_technologies: array(body.excludedTechnologies),
      scoring_weights: scoringWeights,
      timezone,
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined
    };
    const { data, error } = await client
      .schema("app")
      .from("job_search_profiles")
      .update(update)
      .eq("id", id)
      .eq("owner_id", ownerId)
      .is("archived_at", null)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return apiResponse(data, request, data ? 200 : 404);
  });
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const { data, error } = await client
      .schema("app")
      .from("job_search_profiles")
      .update({ enabled: false, archived_at: new Date().toISOString() })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return apiResponse({ removed: Boolean(data) }, request, data ? 200 : 404);
  });
}
