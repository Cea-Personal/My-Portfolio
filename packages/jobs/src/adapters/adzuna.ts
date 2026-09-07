import { contractAdapter, fetchSourceJson, type JobSourceAdapter } from "./registry";
import { bearerSecret, profileQuery, searchText } from "./api-utils";

/** Adzuna search API. Both app_id and app_key are required by Adzuna. */
export const adzunaAdapter: JobSourceAdapter = contractAdapter({
  type: "adzuna",
  version: "v1",
  capabilities: ["collect", "search", "pagination"],
  async collect(input) {
    const appId = input.credentials?.applicationId ?? process.env.ADZUNA_APP_ID;
    const appKey = bearerSecret(input) ?? process.env.ADZUNA_APP_KEY;
    if (!appId || !appKey) throw new Error("SOURCE_CREDENTIALS_MISSING:ADZUNA_APP_ID/ADZUNA_APP_KEY");
    const country = String(input.query?.country ?? process.env.ADZUNA_COUNTRY ?? "gb").toLowerCase();
    const configured = input.endpoint ?? `https://api.adzuna.com/v1/api/jobs/${country}/search/1`;
    const queryText = searchText(input);
    const where = profileQuery(input, "location").join(" ");
    const maxAge = Number(input.query?.maxJobAgeDays);
    const records: Record<string, unknown>[] = [];
    for (let page = 1; page <= 1; page += 1) {
      const endpoint = configured
        .replace(/\{country\}/gi, country)
        .replace(/\{page\}/gi, String(page))
        .replace(/\/search\/\d+(?=\?|$)/, `/search/${page}`);
      const payload = (await fetchSourceJson({
        ...input,
        endpoint,
        query: {
          app_id: appId,
          app_key: appKey,
          "content-type": "application/json",
          results_per_page: 25,
          ...(queryText ? { what: queryText } : {}),
          ...(where ? { where } : {}),
          ...(Number.isInteger(maxAge) && maxAge > 0 ? { max_days_old: maxAge } : {}),
          sort_by: "date",
          page
        }
      })) as Record<string, unknown>;
      const pageResults = Array.isArray(payload.results) ? payload.results : [];
      for (const value of pageResults) {
        if (!value || typeof value !== "object") continue;
        const job = value as Record<string, unknown>;
        const company =
          job.company && typeof job.company === "object"
            ? String((job.company as Record<string, unknown>).display_name ?? "")
            : String(job.company ?? "");
        const location =
          job.location && typeof job.location === "object"
            ? String((job.location as Record<string, unknown>).display_name ?? "")
            : String(job.location ?? "");
        records.push({
          id: job.id,
          title: job.title,
          company,
          location,
          url: job.redirect_url ?? job.url,
          description: job.description,
          postedAt: job.created
        });
      }
      if (pageResults.length < 50) break;
    }
    return records;
  }
});
