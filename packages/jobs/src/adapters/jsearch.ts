import { contractAdapter, fetchSourceJson, type JobSourceAdapter } from "./registry";
import { bearerSecret, profileQuery, recordsFromPayload, normalizedRecord, searchText } from "./api-utils";

/** JSearch on RapidAPI. The RapidAPI key is supplied through secret_ref. */
export const jsearchAdapter: JobSourceAdapter = contractAdapter({
  type: "jsearch",
  version: "v1",
  capabilities: ["collect", "search", "pagination"],
  async collect(input) {
    const key = bearerSecret(input) ?? process.env.JSEARCH_RAPIDAPI_KEY ?? process.env.RAPIDAPI_KEY;
    if (!key) throw new Error("SOURCE_CREDENTIALS_MISSING:JSEARCH_RAPIDAPI_KEY");
    const endpoint = input.endpoint ?? "https://jsearch.p.rapidapi.com/search";
    const locations = profileQuery(input, "location");
    const query = [searchText(input), locations.join(" ")].filter(Boolean).join(" in ");
    const maxAge = Number(input.query?.maxJobAgeDays);
    const datePosted = Number.isInteger(maxAge) && maxAge <= 1 ? "today" : maxAge <= 7 ? "week" : "month";
    const response = await fetchSourceJson({
      ...input,
      endpoint,
      headers: {
        "X-RapidAPI-Key": key,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
        accept: "application/json"
      },
      query: {
        query: query || "software engineer",
        page: 1,
        num_pages: 1,
        date_posted: datePosted
      }
    });
    return recordsFromPayload(response).map(normalizedRecord);
  }
});
