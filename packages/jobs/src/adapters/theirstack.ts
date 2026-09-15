import { contractAdapter, fetchSourceJson, type JobSourceAdapter } from "./registry";
import { bearerSecret, profileQuery, recordsFromPayload, normalizedRecord } from "./api-utils";

interface LocationCatalogRecord {
  id?: unknown;
  name?: unknown;
  display_name?: unknown;
}

async function resolveTheirStackLocations(
  input: Parameters<JobSourceAdapter["collect"]>[0],
  locations: readonly string[],
  key: string
): Promise<{ ids: number[]; patterns: string[]; remote: boolean }> {
  const ids: number[] = [];
  const patterns: string[] = [];
  let remote = false;
  const uniqueLocations = [
    ...new Set(locations.map((location) => location.trim()).filter(Boolean))
  ];
  await Promise.all(
    uniqueLocations.map(async (location) => {
      if (location.toLowerCase() === "remote") {
        remote = true;
        return;
      }
      if (/^\d+$/.test(location)) {
        ids.push(Number(location));
        return;
      }
      try {
        const payload = await fetchSourceJson({
          endpoint: "https://api.theirstack.com/v0/catalog/locations",
          headers: { authorization: `Bearer ${key}`, accept: "application/json" },
          query: { name: location, limit: 10 },
          ...(input.fetcher ? { fetcher: input.fetcher } : {}),
          ...(input.signal ? { signal: input.signal } : {})
        });
        const candidates = recordsFromPayload(payload) as LocationCatalogRecord[];
        const normalizedLocation = location.toLowerCase();
        const candidate =
          candidates.find((value) => {
            const name = typeof value.name === "string" ? value.name : "";
            const display = typeof value.display_name === "string" ? value.display_name : "";
            return [name, display].some((item) => item.toLowerCase() === normalizedLocation);
          }) ?? candidates[0];
        const id =
          candidate && typeof candidate.id === "number" ? candidate.id : Number(candidate?.id);
        if (Number.isInteger(id) && id > 0) ids.push(id);
        else patterns.push(location);
      } catch {
        // The catalog is an enhancement, not a hard dependency. The
        // deprecated pattern filter keeps the source usable when a catalog
        // lookup is unavailable; local eligibility still enforces the profile.
        patterns.push(location);
      }
    })
  );
  return { ids: [...new Set(ids)], patterns: [...new Set(patterns)], remote };
}

/** TheirStack job search API (POST). */
export const theirStackAdapter: JobSourceAdapter = contractAdapter({
  type: "theirstack",
  version: "v1",
  capabilities: ["collect", "search", "pagination"],
  async collect(input) {
    const key = bearerSecret(input) ?? process.env.THEIRSTACK_API_KEY;
    if (!key) throw new Error("SOURCE_CREDENTIALS_MISSING:THEIRSTACK_API_KEY");
    const endpoint = input.endpoint ?? "https://api.theirstack.com/v1/jobs/search";
    const titles = [...profileQuery(input, "title"), ...profileQuery(input, "preferredTitle")];
    const excludedTitles = profileQuery(input, "excludedTitle");
    const locations = profileQuery(input, "location");
    const technologies = [
      ...profileQuery(input, "technology"),
      ...profileQuery(input, "preferredTechnology")
    ];
    const locationFilters = await resolveTheirStackLocations(input, locations, key);
    const maxAge = Number(input.query?.maxJobAgeDays);
    const lastRunAt =
      typeof input.query?.lastRunAt === "string" ? input.query.lastRunAt : undefined;
    const jobs: Record<string, unknown>[] = [];
    for (let page = 1; page <= 1; page += 1) {
      const payload = await fetchSourceJson({
        ...input,
        endpoint,
        method: "POST",
        headers: { authorization: `Bearer ${key}`, accept: "application/json" },
        body: {
          ...(titles.length ? { job_title_or: titles } : {}),
          ...(excludedTitles.length ? { job_title_not: excludedTitles } : {}),
          ...(locationFilters.ids.length
            ? { job_location_or: locationFilters.ids.map((id) => ({ id })) }
            : {}),
          ...(locationFilters.patterns.length
            ? { job_location_pattern_or: locationFilters.patterns }
            : {}),
          ...(locationFilters.remote ? { remote: true } : {}),
          ...(technologies.length
            ? {
                job_technology_slug_or: technologies.map((value) =>
                  value.toLowerCase().replace(/[^a-z0-9]+/g, "-")
                )
              }
            : {}),
          ...(Number.isInteger(maxAge) && maxAge > 0
            ? { posted_at_max_age_days: maxAge }
            : { posted_at_max_age_days: 30 }),
          ...(lastRunAt ? { discovered_at_gte: new Date(lastRunAt).toISOString() } : {}),
          page: page - 1,
          limit: 10
        }
      });
      const pageJobs = recordsFromPayload(payload);
      jobs.push(...pageJobs);
      if (pageJobs.length < 25) break;
    }
    return jobs.map(normalizedRecord);
  }
});
