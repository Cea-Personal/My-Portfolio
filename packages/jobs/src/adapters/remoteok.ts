import { contractAdapter, fetchSourceJson, type JobSourceAdapter } from "./registry";
import { bearerSecret, recordsFromPayload } from "./api-utils";

/** Remote OK's public feed, or a RapidAPI-hosted Remote OK endpoint. */
export const remoteOkAdapter: JobSourceAdapter = contractAdapter({
  type: "remoteok",
  version: "v1",
  capabilities: ["collect", "search"],
  async collect(input) {
    const technology = input.query?.technology;
    const tag = typeof technology === "string" && technology.trim() ? technology.trim() : undefined;
    const endpoint = input.endpoint ?? "https://remoteok.com/api";
    const host = new URL(endpoint).hostname.toLowerCase();
    const rapidApi = host.endsWith(".rapidapi.com");
    const key = rapidApi
      ? (process.env.RAPIDAPI_KEY ?? bearerSecret(input) ?? process.env.REMOTEOK_RAPIDAPI_KEY)
      : bearerSecret(input);
    if (rapidApi && !key) throw new Error("SOURCE_CREDENTIALS_MISSING:RAPIDAPI_KEY");
    const headers = rapidApi
      ? {
          "X-RapidAPI-Key": key as string,
          "X-RapidAPI-Host": host,
          accept: "application/json"
        }
      : {
          accept: "application/json",
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36",
          ...(input.headers ?? {})
        };
    const fetchFeed = (filtered: boolean) =>
      fetchSourceJson({
        ...input,
        endpoint,
        headers,
        ...(filtered && tag ? { query: { tag } } : {})
      });
    let payload: unknown;
    try {
      payload = await fetchFeed(Boolean(tag));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (rapidApi && /^SOURCE_HTTP_(401|403)/.test(message)) {
        throw new Error(
          `REMOTEOK_RAPIDAPI_UNAUTHORIZED: subscribe to the selected Remote OK RapidAPI listing, then verify RAPIDAPI_KEY`
        );
      }
      if (rapidApi && /^SOURCE_HTTP_404/.test(message)) {
        throw new Error(
          `REMOTEOK_RAPIDAPI_ENDPOINT_NOT_FOUND:${host}${new URL(endpoint).pathname} — copy the endpoint from the subscribed RapidAPI listing`
        );
      }
      // Tag filtering is not consistently supported by the public feed. A
      // clean unfiltered retry lets the local eligibility pipeline decide.
      if (!tag) throw error;
      payload = await fetchFeed(false);
    }
    // Some edge/cache variants return an empty tag-filtered window. Retry the
    // bounded public feed rather than recording a misleading zero-result run.
    if (tag && Array.isArray(payload) && payload.length <= 1) payload = await fetchFeed(false);
    const values = rapidApi ? recordsFromPayload(payload, ["jobs", "data", "results"]) : payload;
    if (!Array.isArray(values)) return [];
    return values.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const job = value as Record<string, unknown>;
      const title =
        typeof job.position === "string"
          ? job.position
          : typeof job.title === "string"
            ? job.title
            : "";
      const company = typeof job.company === "string" ? job.company : "";
      const url = typeof job.url === "string" ? job.url : undefined;
      if (!title || !company || !url) return [];
      const location = [typeof job.location === "string" ? job.location : undefined, "Remote"]
        .filter(Boolean)
        .join(" · ");
      const externalId =
        typeof job.id === "string" ? job.id : typeof job.slug === "string" ? job.slug : undefined;
      return [
        {
          ...(externalId ? { externalId } : {}),
          company,
          title,
          location,
          canonicalUrl: url,
          ...(typeof job.description === "string" ? { description: job.description } : {})
        }
      ];
    });
  }
});
