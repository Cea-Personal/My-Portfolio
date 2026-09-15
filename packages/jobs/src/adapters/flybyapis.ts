import { contractAdapter, fetchSourceJson, type JobSourceAdapter } from "./registry";
import {
  bearerSecret,
  profileQuery,
  recordsFromPayload,
  normalizedRecord,
  searchText
} from "./api-utils";

/** FlyByAPIs Jobs Search API (RapidAPI). */
export const flybyApisAdapter: JobSourceAdapter = contractAdapter({
  type: "flybyapis",
  version: "v1",
  capabilities: ["collect", "search", "pagination"],
  async collect(input) {
    const key =
      process.env.RAPIDAPI_KEY ?? bearerSecret(input) ?? process.env.FLYBYAPIS_RAPIDAPI_KEY;
    if (!key) throw new Error("SOURCE_CREDENTIALS_MISSING:RAPIDAPI_KEY");
    const endpoint = input.endpoint ?? "https://jobs-search-api.p.rapidapi.com/jobs/search";
    const rapidApiHost = new URL(endpoint).hostname.toLowerCase();
    const locations = profileQuery(input, "location");
    const query = [searchText(input), locations.join(" ")].filter(Boolean).join(" in ");
    const maxAge = Number(input.query?.maxJobAgeDays);
    const requestBody = {
      query: query || "software engineer",
      type: profileQuery(input, "employmentType").join(",") || "full-time",
      date_posted: Number.isInteger(maxAge) && maxAge <= 1 ? "day" : maxAge <= 3 ? "3days" : "week",
      page: 1
    };
    let payload: unknown;
    try {
      payload = await fetchSourceJson({
        ...input,
        endpoint,
        method: "POST",
        headers: {
          "X-RapidAPI-Key": key,
          // Keep the host aligned with the configured RapidAPI listing. This
          // supports alternate FlyByAPIs listings while sharing RAPIDAPI_KEY.
          "X-RapidAPI-Host": rapidApiHost,
          accept: "application/json"
        },
        body: requestBody
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/^SOURCE_HTTP_(401|403)/.test(message)) {
        throw new Error(
          `FLYBYAPIS_RAPIDAPI_UNAUTHORIZED: subscribe to the FlyByAPIs Jobs Search listing, then verify RAPIDAPI_KEY`
        );
      }
      if (/^SOURCE_HTTP_404/.test(message)) {
        throw new Error(
          `FLYBYAPIS_RAPIDAPI_ENDPOINT_NOT_FOUND:${rapidApiHost}${new URL(endpoint).pathname} — copy the endpoint from the subscribed RapidAPI listing`
        );
      }
      throw error;
    }
    return recordsFromPayload(payload, ["jobs", "data", "results"]).map(normalizedRecord);
  }
});
