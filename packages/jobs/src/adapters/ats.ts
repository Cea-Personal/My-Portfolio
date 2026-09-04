import { contractAdapter, fetchSourceJson, type JobSourceAdapter } from "./registry";

function records(payload: unknown): readonly Record<string, unknown>[] {
  if (Array.isArray(payload))
    return payload.filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object")
    );
  if (!payload || typeof payload !== "object") return [];
  const value = payload as Record<string, unknown>;
  for (const key of ["jobs", "results", "data", "positions", "offers"]) {
    if (Array.isArray(value[key])) return records(value[key]);
  }
  return [];
}

function normalize(job: Record<string, unknown>) {
  const location = job.location ?? job.locations ?? job.city ?? "";
  return {
    externalId: String(job.id ?? job.jobId ?? job.slug ?? job.url ?? ""),
    company: String(job.company ?? job.companyName ?? job.organization ?? ""),
    title: String(job.title ?? job.name ?? job.position ?? ""),
    location: typeof location === "object" ? JSON.stringify(location) : String(location),
    canonicalUrl: String(job.url ?? job.jobUrl ?? job.absoluteUrl ?? job.applyUrl ?? ""),
    description: String(job.description ?? job.descriptionHtml ?? job.content ?? job.summary ?? "")
  };
}

export function createAtsAdapter(type: string): JobSourceAdapter {
  return contractAdapter({
    type,
    version: "v1",
    capabilities: ["collect", "search", "fetch", "pagination", "normalize"],
    async collect(input) {
      return records(await fetchSourceJson(input)).map(normalize);
    },
    normalize: (record) => normalize(record as Record<string, unknown>)
  });
}

export const workableAdapter = createAtsAdapter("workable");
export const smartRecruitersAdapter = createAtsAdapter("smartrecruiters");
export const teamtailorAdapter = createAtsAdapter("teamtailor");
export const personioAdapter = createAtsAdapter("personio");
export const recruiteeAdapter = createAtsAdapter("recruitee");
