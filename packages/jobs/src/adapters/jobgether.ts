import { contractAdapter, fetchSourceJson, type JobSourceAdapter } from "./registry";

function queryValue(input: { query?: Record<string, string | number | boolean> }, key: string) {
  const value = input.query?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function queryList(input: { query?: Record<string, string | number | boolean> }, key: string) {
  return queryValue(input, key)
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function slugs(values: readonly string[] | undefined, omitRemote = false): string | undefined {
  const result = (values ?? [])
    .map((value) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
    .filter((value) => value && (!omitRemote || value !== "remote"));
  return result.length ? [...new Set(result)].join(",") : undefined;
}

function enumValues(
  values: readonly string[] | undefined,
  mapping: Readonly<Record<string, string>>
): string | undefined {
  const result = (values ?? []).flatMap((value) => {
    const normalized = value.trim().toLowerCase().replace(/[_\s]+/g, "-");
    return mapping[normalized] ? [mapping[normalized]] : [];
  });
  return result.length ? [...new Set(result)].join(",") : undefined;
}

function canonicalEndpoint(value: string | undefined): string {
  const endpoint = value ?? "https://jobgether.com/astroapi/ai/jobs.json";
  try {
    const url = new URL(endpoint);
    if (url.hostname.toLowerCase() === "www.jobgether.com") url.hostname = "jobgether.com";
    const path = url.pathname.replace(/\/+$/, "");
    if (
      url.hostname.toLowerCase() === "jobgether.com" &&
      (path === "" ||
        path === "/developers" ||
        path === "/api/v1/jobs" ||
        path === "/astroapi/ai/jobs" ||
        path === "/astroapi/ai/jobs.json")
    ) {
      url.pathname = "/astroapi/ai/jobs.json";
      url.search = "";
    }
    return url.toString();
  } catch {
    return endpoint;
  }
}

/** Public, unauthenticated Jobgether search API. */
export const jobgetherAdapter: JobSourceAdapter = contractAdapter({
  type: "jobgether",
  version: "v1",
  capabilities: ["collect", "search", "pagination"],
  async collect(input) {
    const title = queryValue(input, "title");
    const preferredTitle = queryValue(input, "preferredTitle");
    const technology = queryValue(input, "technology");
    const preferredTechnology = queryValue(input, "preferredTechnology");
    const preferredCompany = queryValue(input, "preferredCompany");
    const language = queryValue(input, "language");
    const locationValues = queryList(input, "location");
    const location = slugs(locationValues, true);
    const industries = slugs(queryList(input, "industry"));
    const contractType = enumValues(queryList(input, "employmentType"), {
      "full-time": "full-time",
      fulltime: "full-time",
      permanent: "full-time",
      "part-time": "part-time",
      parttime: "part-time",
      freelance: "freelance",
      contractor: "freelance",
      contract: "fixed-term",
      "fixed-term": "fixed-term",
      internship: "internships",
      internships: "internships"
    });
    const experience = enumValues(queryList(input, "seniority"), {
      entry: "entry-level-graduate",
      junior: "junior-1-2-years",
      "entry-level": "entry-level-graduate",
      "junior-level": "junior-1-2-years",
      mid: "mid-level-2-5-years",
      "mid-level": "mid-level-2-5-years",
      senior: "senior-5-10-years",
      lead: "senior-5-10-years",
      staff: "senior-5-10-years",
      principal: "expert-10-years",
      expert: "expert-10-years"
    });
    const arrangementValues = [
      ...(queryList(input, "workArrangement") ?? []),
      ...(queryList(input, "remoteRestriction") ?? [])
    ].map((value) => value.toLowerCase());
    const remoteType = arrangementValues.some((value) => value.includes("hybrid"))
      ? "hybrid"
      : arrangementValues.some((value) => value.includes("remote"))
        ? "full-remote"
        : undefined;
    const includeHybrid = arrangementValues.some((value) => value.includes("hybrid"));
    const minimumSalary = queryValue(input, "minimumSalary");
    const salaryCurrency = queryValue(input, "salaryCurrency")?.toUpperCase();
    const keyword = [
      title,
      preferredTitle,
      technology,
      preferredTechnology,
      preferredCompany,
      language
    ]
      .filter(Boolean)
      .join(" ");
    const endpoint = canonicalEndpoint(input.endpoint);
    const request = (includeStructuredFilters: boolean, includeKeyword = true) =>
      fetchSourceJson({
        ...input,
        endpoint,
        query: {
          ...(includeKeyword && keyword ? { keyword } : {}),
          ...(includeStructuredFilters && location ? { locations: location } : {}),
          ...(includeStructuredFilters && industries ? { industries } : {}),
          ...(includeStructuredFilters && contractType ? { contractType } : {}),
          ...(includeStructuredFilters && experience ? { experience } : {}),
          ...(includeStructuredFilters && remoteType ? { remoteType } : {}),
          ...(includeStructuredFilters && includeHybrid ? { includeHybrid: true } : {}),
          ...(includeStructuredFilters && minimumSalary ? { salaryMin: minimumSalary } : {}),
          ...(includeStructuredFilters && salaryCurrency ? { currency: salaryCurrency } : {}),
          sort: "date",
          page: 1,
          limit: 25
        }
      });
    let payload: { jobs?: readonly Record<string, unknown>[] };
    try {
      payload = (await request(true)) as { jobs?: readonly Record<string, unknown>[] };
    } catch (error) {
      // Jobgether rejects unknown location slugs with 400. Do not mark the
      // source unhealthy for an optional filter the provider cannot express;
      // the canonical eligibility filter will enforce the profile locally.
      if (!(error instanceof Error) || !error.message.startsWith("SOURCE_HTTP_400"))
        throw error;
      payload = (await request(false)) as { jobs?: readonly Record<string, unknown>[] };
    }
    // Location slugs and free-text combinations can be accepted by the API
    // but still produce an empty page. Fall back to keyword-only, then the
    // broad first page; local eligibility performs the final filtering.
    if (!payload.jobs?.length && location)
      payload = (await request(false)) as { jobs?: readonly Record<string, unknown>[] };
    if (!payload.jobs?.length && keyword)
      payload = (await request(false, false)) as { jobs?: readonly Record<string, unknown>[] };
    return (payload.jobs ?? []).flatMap((job) => {
      const id = typeof job.id === "string" ? job.id : undefined;
      const titleValue = typeof job.title === "string" ? job.title : "";
      const company = typeof job.company === "string" ? job.company : "";
      const url = typeof job.url === "string" ? job.url : undefined;
      const description = typeof job.description === "string" ? job.description : undefined;
      const remote = typeof job.remote === "string" ? job.remote : undefined;
      const location = [typeof job.location === "string" ? job.location : undefined, remote]
        .filter(Boolean)
        .join(" · ");
      if (!titleValue || !company || !url) return [];
      return [
        {
          ...(id ? { externalId: id } : {}),
          company,
          title: titleValue,
          ...(location ? { location } : {}),
          canonicalUrl: url,
          ...(description ? { description } : {})
        }
      ];
    });
  }
});
