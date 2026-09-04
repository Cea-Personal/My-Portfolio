import { contractAdapter, fetchSourceText, type JobSourceAdapter } from "./registry";

function walk(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(walk);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const graph = Array.isArray(record["@graph"]) ? record["@graph"] : [];
  return [record, ...graph.flatMap(walk)];
}

function normalize(record: Record<string, unknown>) {
  const hiring = record.hiringOrganization;
  const company =
    hiring && typeof hiring === "object" ? (hiring as Record<string, unknown>).name : hiring;
  const location = record.jobLocation;
  return {
    externalId: String(
      record.identifier && typeof record.identifier === "object"
        ? ((record.identifier as Record<string, unknown>).value ?? record.url ?? "")
        : (record.identifier ?? record.url ?? "")
    ),
    company: String(company ?? ""),
    title: String(record.title ?? ""),
    location: typeof location === "object" ? JSON.stringify(location) : String(location ?? ""),
    canonicalUrl: String(record.url ?? ""),
    description: String(record.description ?? "")
  };
}

export const structuredAdapter: JobSourceAdapter = contractAdapter({
  type: "structured",
  version: "v1",
  capabilities: ["collect", "search", "fetch", "normalize", "json-ld"],
  async collect(input) {
    const html = await fetchSourceText(input);
    return [
      ...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
    ].flatMap((match) => {
      try {
        return walk(JSON.parse(match[1] ?? ""))
          .filter((item) => item["@type"] === "JobPosting")
          .map(normalize);
      } catch {
        return [];
      }
    });
  }
});
