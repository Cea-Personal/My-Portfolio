import { contractAdapter, fetchSourceJson, type JobSourceAdapter } from "./registry";
import { bearerSecret, profileQuery, recordsFromPayload, normalizedRecord } from "./api-utils";

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
    const technologies = [...profileQuery(input, "technology"), ...profileQuery(input, "preferredTechnology")];
    const maxAge = Number(input.query?.maxJobAgeDays);
    const lastRunAt = typeof input.query?.lastRunAt === "string" ? input.query.lastRunAt : undefined;
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
          ...(locations.length ? { job_location_or: locations } : {}),
          ...(technologies.length ? { job_technology_slug_or: technologies.map((value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-")) } : {}),
          ...(Number.isInteger(maxAge) && maxAge > 0 ? { posted_at_max_age_days: maxAge } : { posted_at_max_age_days: 30 }),
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
