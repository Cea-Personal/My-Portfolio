import { fetchSourceJson, type JobSourceAdapter } from "./registry";
export const leverAdapter: JobSourceAdapter = {
  type: "lever",
  version: "v1",
  capabilities: ["collect", "pagination"],
  async collect(input) {
    const payload = (await fetchSourceJson(input)) as
      | readonly Record<string, unknown>[]
      | { data?: readonly Record<string, unknown>[] };
    const jobs: readonly Record<string, unknown>[] = Array.isArray(payload)
      ? payload
      : ((payload as { data?: readonly Record<string, unknown>[] }).data ?? []);
    return jobs.map((job) => ({
      externalId: String(job.id ?? ""),
      company: String(job.company ?? ""),
      title: String(job.text ?? job.title ?? ""),
      location: String((job.categories as Record<string, unknown> | undefined)?.location ?? ""),
      canonicalUrl: String(job.hostedUrl ?? job.applyUrl ?? ""),
      description: String(job.descriptionPlain ?? job.description ?? "")
    }));
  }
};
