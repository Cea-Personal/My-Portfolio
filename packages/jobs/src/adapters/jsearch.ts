import { contractAdapter, fetchSourceJson, type JobSourceAdapter } from "./registry";
import {
  bearerSecret,
  profileQuery,
  recordsFromPayload,
  normalizedRecord,
  searchText
} from "./api-utils";

/**
 * JSearch via RapidAPI (with optional compatibility for an explicitly supplied
 * OpenWeb Ninja endpoint).
 *
 * The two gateways use different authentication headers.  Detecting the
 * gateway from the configured endpoint keeps the source type stable while
 * allowing an owner to use the OpenWeb Ninja key they already have.
 */
export const jsearchAdapter: JobSourceAdapter = contractAdapter({
  type: "jsearch",
  version: "v1",
  capabilities: ["collect", "search", "pagination"],
  async collect(input) {
    const secretRef = input.credentials?.secretRef?.trim().toUpperCase();
    const configuredEndpoint = input.endpoint;
    // The endpoint is authoritative. A legacy secret reference must not
    // silently change a RapidAPI URL into the OpenWeb Ninja gateway.
    const endpoint = configuredEndpoint ?? "https://jsearch.p.rapidapi.com/search";
    const gateway = new URL(endpoint).hostname.toLowerCase();
    const openWebNinja =
      gateway === "api.openwebninja.com" || gateway.endsWith(".openwebninja.com");
    const key =
      (openWebNinja ? bearerSecret(input) : undefined) ??
      (openWebNinja ? process.env.OPENWEBNINJA_API_KEY : undefined) ??
      (openWebNinja ? process.env.JSEARCH_API_KEY : undefined) ??
      process.env.RAPIDAPI_KEY ??
      (!openWebNinja ? bearerSecret(input) : undefined) ??
      process.env.JSEARCH_RAPIDAPI_KEY;
    if (!key)
      throw new Error(
        `SOURCE_CREDENTIALS_MISSING:${openWebNinja ? "JSEARCH_API_KEY" : "RAPIDAPI_KEY"}`
      );
    const locations = profileQuery(input, "location");
    const query = [searchText(input), locations.join(" ")].filter(Boolean).join(" in ");
    const maxAge = Number(input.query?.maxJobAgeDays);
    const datePosted =
      Number.isInteger(maxAge) && maxAge <= 1 ? "today" : maxAge <= 7 ? "week" : "month";
    let response: unknown;
    try {
      response = await fetchSourceJson({
        ...input,
        endpoint,
        headers: {
          ...(openWebNinja
            ? { "x-api-key": key }
            : {
                "X-RapidAPI-Key": key,
                // RapidAPI host identifies the subscribed API listing. Derive
                // it from the endpoint so alternate JSearch listings work
                // with the same shared RAPIDAPI_KEY.
                "X-RapidAPI-Host": gateway
              }),
          accept: "application/json"
        },
        query: {
          query: query || "software engineer",
          page: 1,
          num_pages: 1,
          date_posted: datePosted
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/^SOURCE_HTTP_(401|403)/.test(message)) {
        throw new Error(
          `${openWebNinja ? "JSEARCH_OPENWEBNINJA" : "JSEARCH_RAPIDAPI"}_UNAUTHORIZED: subscribe to JSearch in the selected provider, then verify the API key and endpoint`
        );
      }
      if (/^SOURCE_HTTP_404/.test(message) && !openWebNinja) {
        throw new Error(
          `JSEARCH_RAPIDAPI_ENDPOINT_NOT_FOUND:${gateway}${new URL(endpoint).pathname} — copy the endpoint from the subscribed RapidAPI listing`
        );
      }
      throw error;
    }
    // OpenWeb Ninja wraps the JSearch payload as { data: { jobs: [...] } };
    // RapidAPI returns { data: [...] }. Support both response shapes.
    const records = recordsFromPayload(response);
    if (records.length) return records.map(normalizedRecord);
    if (response && typeof response === "object") {
      const data = (response as Record<string, unknown>).data;
      return recordsFromPayload(data).map(normalizedRecord);
    }
    return [];
  }
});
