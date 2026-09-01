import { fetchSourceJson, type JobSourceAdapter } from "./registry";
export const ashbyAdapter: JobSourceAdapter = {
  type: "ashby",
  version: "v1",
  capabilities: ["collect"],
  async collect(input) {
    const payload = (await fetchSourceJson(input)) as { jobs?: readonly Record<string, unknown>[] };
    return (payload.jobs ?? []).map((job) => ({
      externalId: String(job.jobUrl ?? job.id ?? ""),
      company: String(job.companyName ?? ""),
      title: String(job.title ?? ""),
      location: String(job.location ?? ""),
      canonicalUrl: String(job.jobUrl ?? ""),
      description: String(job.descriptionHtml ?? job.description ?? "")
    }));
  }
};
