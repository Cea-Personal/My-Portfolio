import { contractAdapter, fetchSourceJson, type JobSourceAdapter } from "./registry";
import { bearerSecret, profileQuery, recordsFromPayload, normalizedRecord } from "./api-utils";

/** JobsPipe normalized jobs API (POST). */
export const jobsPipeAdapter: JobSourceAdapter = contractAdapter({
  type: "jobspipe",
  version: "v1",
  capabilities: ["collect", "search", "pagination"],
  async collect(input) {
    const key = bearerSecret(input) ?? process.env.JOBSPIPE_API_KEY;
    if (!key) throw new Error("SOURCE_CREDENTIALS_MISSING:JOBSPIPE_API_KEY");
    const endpoint = input.endpoint ?? "https://api.jobspipe.dev/v1/jobs/search";
    const titles = [...profileQuery(input, "title"), ...profileQuery(input, "preferredTitle")];
    const locations = profileQuery(input, "location");
    const technologies = [...profileQuery(input, "technology"), ...profileQuery(input, "preferredTechnology")];
    const maxAge = Number(input.query?.maxJobAgeDays);
    const lastRunAt = typeof input.query?.lastRunAt === "string" ? input.query.lastRunAt : undefined;
    const jobs: Record<string, unknown>[] = [];
    let cursor: string | undefined;
    for (let page = 1; page <= 1; page += 1) {
      const payload = (await fetchSourceJson({
        ...input,
        endpoint,
        method: "POST",
        headers: { authorization: `Bearer ${key}`, accept: "application/json" },
        body: {
          ...(titles.length ? { job_title_or: titles } : {}),
          ...(locations.length ? { job_location_or: locations } : {}),
          ...(technologies.length ? { skills_or: technologies.map((value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-")) } : {}),
          ...(profileQuery(input, "excludedTitle").length ? { job_title_not: profileQuery(input, "excludedTitle") } : {}),
          ...(profileQuery(input, "workArrangement").some((value) => value.toLowerCase().includes("remote")) ? { remote: true } : {}),
          ...(Number.isInteger(maxAge) && maxAge > 0 ? { posted_at_max_age_days: maxAge } : { posted_at_max_age_days: 30 }),
          ...(lastRunAt ? { discovered_at_gte: new Date(lastRunAt).toISOString() } : {}),
          ...(cursor ? { cursor } : { page: page - 1 }),
          limit: 10,
          include_total_results: false
        }
      })) as Record<string, unknown>;
      const pageJobs = recordsFromPayload(payload);
      jobs.push(...pageJobs);
      const metadata = payload.metadata && typeof payload.metadata === "object" ? payload.metadata as Record<string, unknown> : {};
      cursor = typeof metadata.next_cursor === "string" ? metadata.next_cursor : undefined;
      if (!cursor || !pageJobs.length) break;
    }
    return jobs.map(normalizedRecord);
  }
});
