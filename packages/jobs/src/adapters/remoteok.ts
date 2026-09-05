import { contractAdapter, fetchSourceJson, type JobSourceAdapter } from "./registry";

/** Remote OK's public JSON feed. Metadata/terms objects are discarded safely. */
export const remoteOkAdapter: JobSourceAdapter = contractAdapter({
  type: "remoteok",
  version: "v1",
  capabilities: ["collect", "search"],
  async collect(input) {
    const technology = input.query?.technology;
    const tag = typeof technology === "string" && technology.trim() ? technology.trim() : undefined;
    const endpoint = input.endpoint ?? "https://remoteok.com/api";
    // Remote OK's Cloudflare edge redirects bot-like requests. Its public
    // feed requires a browser-shaped User-Agent even though it has no key.
    const headers = {
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
      // Tag filtering is not consistently supported by the public feed. A
      // clean unfiltered retry lets the local eligibility pipeline decide.
      if (!tag) throw error;
      payload = await fetchFeed(false);
    }
    // Some edge/cache variants return an empty tag-filtered window. Retry the
    // bounded public feed rather than recording a misleading zero-result run.
    if (tag && Array.isArray(payload) && payload.length <= 1) payload = await fetchFeed(false);
    if (!Array.isArray(payload)) return [];
    return payload.flatMap((value) => {
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
