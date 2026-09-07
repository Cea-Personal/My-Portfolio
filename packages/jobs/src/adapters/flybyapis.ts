import { contractAdapter, fetchSourceJson, type JobSourceAdapter } from "./registry";
import { bearerSecret, profileQuery, recordsFromPayload, normalizedRecord, searchText } from "./api-utils";

/** FlyByAPIs Jobs Search API (RapidAPI). */
export const flybyApisAdapter: JobSourceAdapter = contractAdapter({
  type: "flybyapis",
  version: "v1",
  capabilities: ["collect", "search", "pagination"],
  async collect(input) {
    const key = bearerSecret(input) ?? process.env.FLYBYAPIS_RAPIDAPI_KEY ?? process.env.RAPIDAPI_KEY;
    if (!key) throw new Error("SOURCE_CREDENTIALS_MISSING:FLYBYAPIS_RAPIDAPI_KEY");
    const endpoint = input.endpoint ?? "https://jobs-search-api.p.rapidapi.com/jobs/search";
    const locations = profileQuery(input, "location");
    const query = [searchText(input), locations.join(" ")].filter(Boolean).join(" in ");
    const maxAge = Number(input.query?.maxJobAgeDays);
    const payload = await fetchSourceJson({
      ...input,
      endpoint,
      headers: {
        "X-RapidAPI-Key": key,
        "X-RapidAPI-Host": "jobs-search-api.p.rapidapi.com",
        accept: "application/json"
      },
      query: {
        query: query || "software engineer",
        type: profileQuery(input, "employmentType").join(",") || "full-time",
        date_posted: Number.isInteger(maxAge) && maxAge <= 1 ? "day" : maxAge <= 3 ? "3days" : "week",
        page: 1
      }
    });
    return recordsFromPayload(payload).map(normalizedRecord);
  }
});
