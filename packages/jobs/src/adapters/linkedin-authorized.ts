import { fetchSourceJson, type JobSourceAdapter } from "./registry";

/**
 * LinkedIn connector for an authorized/licensed feed or partner endpoint only.
 * It intentionally has no linkedin.com fetcher and no anti-bot behavior. The
 * configured endpoint must be supplied by an approved provider under its terms.
 */
export const linkedinAuthorizedAdapter: JobSourceAdapter = {
  type: "linkedin-authorized",
  version: "v1",
  capabilities: ["collect"],
  async collect(input) {
    const payload = (await fetchSourceJson(input)) as
      | readonly Record<string, unknown>[]
      | { jobs?: readonly Record<string, unknown>[]; data?: readonly Record<string, unknown>[] };
    const objectPayload = payload as {
      jobs?: readonly Record<string, unknown>[];
      data?: readonly Record<string, unknown>[];
    };
    const jobs: readonly Record<string, unknown>[] = Array.isArray(payload)
      ? (payload as readonly Record<string, unknown>[])
      : (objectPayload.jobs ?? objectPayload.data ?? []);
    return jobs.map((job) => ({
      externalId: String(job.id ?? job.externalId ?? job.jobId ?? ""),
      company: String(job.company ?? job.companyName ?? ""),
      title: String(job.title ?? job.name ?? ""),
      location: String(job.location ?? ""),
      canonicalUrl: String(job.url ?? job.sourceUrl ?? ""),
      description: String(job.description ?? job.descriptionText ?? "")
    }));
  }
};
