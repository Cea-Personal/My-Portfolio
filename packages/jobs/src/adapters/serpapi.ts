import { contractAdapter, fetchSourceJson, type JobSourceAdapter } from "./registry";
import { bearerSecret, profileQuery, searchText } from "./api-utils";

/** SerpApi Google Jobs engine. */
export const serpApiAdapter: JobSourceAdapter = contractAdapter({
  type: "serpapi",
  version: "v1",
  capabilities: ["collect", "search", "pagination"],
  async collect(input) {
    const key = bearerSecret(input) ?? process.env.SERPAPI_API_KEY;
    if (!key) throw new Error("SOURCE_CREDENTIALS_MISSING:SERPAPI_API_KEY");
    const endpoint = input.endpoint ?? "https://serpapi.com/search.json";
    const locations = profileQuery(input, "location");
    const q = [searchText(input), locations.join(" ")].filter(Boolean).join(" in ") || "software engineer";
    const jobs: Record<string, unknown>[] = [];
    let nextPageToken: string | undefined;
    for (let page = 1; page <= 1; page += 1) {
      const payload = (await fetchSourceJson({
        ...input,
        endpoint,
        query: {
          engine: "google_jobs",
          q,
          api_key: key,
          ...(locations[0] ? { location: locations[0] } : {}),
          ...(nextPageToken ? { next_page_token: nextPageToken } : {})
        }
      })) as Record<string, unknown>;
      const pageJobs = Array.isArray(payload.jobs_results) ? payload.jobs_results : [];
      for (const value of pageJobs) {
        if (!value || typeof value !== "object") continue;
        const job = value as Record<string, unknown>;
        const applyOptions = Array.isArray(job.apply_options) ? job.apply_options : [];
        const firstApply = applyOptions.find((item) => item && typeof item === "object") as Record<string, unknown> | undefined;
        const highlights = Array.isArray(job.job_highlights)
          ? job.job_highlights
              .filter((item) => item && typeof item === "object")
              .map((item) => {
                const record = item as Record<string, unknown>;
                const title = typeof record.title === "string" ? record.title : "";
                const items = Array.isArray(record.items) ? record.items.filter((text): text is string => typeof text === "string") : [];
                return [title, ...items].filter(Boolean).join("\n");
              })
              .filter(Boolean)
              .join("\n")
          : undefined;
        jobs.push({
          id: job.job_id,
          title: job.title,
          company: job.company_name ?? job.company,
          location: job.location,
          description: job.description ?? highlights,
          url: firstApply?.link ?? job.share_link ?? job.link,
          postedAt: job.detected_extensions && typeof job.detected_extensions === "object"
            ? (job.detected_extensions as Record<string, unknown>).posted_at
            : undefined
        });
      }
      const pagination = payload.serpapi_pagination;
      nextPageToken = pagination && typeof pagination === "object"
        ? (pagination as Record<string, unknown>).next_page_token as string | undefined
        : undefined;
      if (!nextPageToken || !pageJobs.length) break;
    }
    return jobs;
  }
});
