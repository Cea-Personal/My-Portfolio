import { contractAdapter, fetchSourceJson, type JobSourceAdapter } from "./registry";
import { profileQuery, recordsFromPayload, normalizedRecord, searchText } from "./api-utils";

/** Arbeitnow's public job-board feed (no API key required). */
export const arbeitnowAdapter: JobSourceAdapter = contractAdapter({
  type: "arbeitnow",
  version: "v1",
  capabilities: ["collect", "search", "pagination"],
  async collect(input) {
    const endpoint = input.endpoint ?? "https://www.arbeitnow.com/api/job-board-api";
    const locations = profileQuery(input, "location");
    const payload = await fetchSourceJson({
      ...input,
      endpoint,
      query: {
        ...(searchText(input) ? { search: searchText(input) } : {}),
        ...(locations.length ? { location: locations.join(",") } : {}),
        page: input.query?.page ?? 1
      }
    });
    return recordsFromPayload(payload).map(normalizedRecord);
  }
});
