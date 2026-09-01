import { fetchSourceJson, type JobSourceAdapter } from "./registry";
export const greenhouseAdapter: JobSourceAdapter = {
  type: "greenhouse",
  version: "v1",
  capabilities: ["collect", "pagination"],
  async collect(input) {
    const payload = (await fetchSourceJson(input)) as
      | { jobs?: readonly Record<string, unknown>[] }
      | readonly Record<string, unknown>[];
    const jobs: readonly Record<string, unknown>[] = Array.isArray(payload)
      ? payload
      : ((payload as { jobs?: readonly Record<string, unknown>[] }).jobs ?? []);
    return jobs.map((job) => ({
      externalId: String(job.id ?? job.requisition_id ?? ""),
      company: String(job.company_name ?? ""),
      title: String(job.title ?? ""),
      location:
        typeof job.location === "object" && job.location !== null
          ? String((job.location as Record<string, unknown>).name ?? "")
          : String(job.location ?? ""),
      canonicalUrl: String(job.absolute_url ?? ""),
      description: String(job.content ?? "")
    }));
  }
};
