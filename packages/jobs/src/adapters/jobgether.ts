import { contractAdapter, fetchSourceJson, type JobSourceAdapter } from "./registry";

function queryValue(input: { query?: Record<string, string | number | boolean> }, key: string) {
  const value = input.query?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
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
  const endpoint = value ?? "https://jobgether.com/api/v1/jobs";
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
      // Normalize legacy/deprecated settings to Jobgether's stable API path.
      url.pathname = "/api/v1/jobs";
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
    const titleReferences = slugs(
      [...(queryList(input, "title") ?? []), ...(queryList(input, "preferredTitle") ?? [])]
    );
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
      : arrangementValues.some((value) => value.includes("remote-first"))
        ? "remote-first"
        : arrangementValues.some((value) => value.includes("remote"))
          ? "full-remote"
          : undefined;
    const includeHybrid = arrangementValues.some((value) => value.includes("hybrid"));
    const minimumSalary = queryValue(input, "minimumSalary");
    const maximumSalary = queryValue(input, "preferredSalary");
    const salaryCurrency = queryValue(input, "salaryCurrency")?.toUpperCase();
    const keyword = [
      technology,
      preferredTechnology,
      preferredCompany,
      language
    ]
      .filter(Boolean)
      .join(" ");
    const fallbackKeyword = [title, preferredTitle, keyword].filter(Boolean).join(" ");
    const maxJobAgeDays = Number(queryValue(input, "maxJobAgeDays"));
    const cutoff = Number.isInteger(maxJobAgeDays) && maxJobAgeDays >= 1
      ? Date.now() - maxJobAgeDays * 24 * 60 * 60 * 1_000
      : undefined;
    const endpoint = canonicalEndpoint(input.endpoint);
    const legacyEndpoint = endpoint === "https://jobgether.com/api/v1/jobs"
      ? "https://jobgether.com/astroapi/ai/jobs.json"
      : undefined;
    const request = (page: number, includeStructuredFilters: boolean, searchKeyword?: string) =>
      (async () => {
        const query = {
          ...(searchKeyword ? { keyword: searchKeyword } : {}),
          ...(includeStructuredFilters && titleReferences
            ? { jobReferences: titleReferences }
            : {}),
          ...(includeStructuredFilters && location ? { locations: location } : {}),
          ...(includeStructuredFilters && industries ? { industries } : {}),
          ...(includeStructuredFilters && contractType ? { contractType } : {}),
          ...(includeStructuredFilters && experience ? { experience } : {}),
          ...(includeStructuredFilters && remoteType ? { remoteType } : {}),
          ...(includeStructuredFilters && includeHybrid ? { includeHybrid: true } : {}),
          ...(includeStructuredFilters && minimumSalary ? { salaryMin: minimumSalary } : {}),
          ...(includeStructuredFilters && maximumSalary ? { salaryMax: maximumSalary } : {}),
          ...(includeStructuredFilters && salaryCurrency ? { currency: salaryCurrency } : {}),
          sort: "relevance",
          page,
          limit: 25
        };
        try {
          return (await fetchSourceJson({ ...input, endpoint, query })) as {
            jobs?: readonly Record<string, unknown>[];
            pagination?: { hasMore?: boolean };
          };
        } catch (error) {
          // The provider currently serves both the stable and legacy public
          // paths. Keep the stable path primary, but recover if one region
          // still returns 404 for it.
          if (
            !legacyEndpoint ||
            !(error instanceof Error) ||
            !error.message.startsWith("SOURCE_HTTP_404")
          )
            throw error;
          return (await fetchSourceJson({ ...input, endpoint: legacyEndpoint, query })) as {
            jobs?: readonly Record<string, unknown>[];
            pagination?: { hasMore?: boolean };
          };
        }
      })();

    const collectPages = async (includeStructuredFilters: boolean, searchKeyword?: string) => {
      const jobs: Record<string, unknown>[] = [];
      for (let page = 1; page <= 10; page += 1) {
        const payload = await request(page, includeStructuredFilters, searchKeyword);
        const pageJobs = Array.isArray(payload.jobs) ? [...payload.jobs] : [];
        jobs.push(...pageJobs);
        const hasMore = payload.pagination?.hasMore;
        if (!pageJobs.length || hasMore === false || (hasMore === undefined && pageJobs.length < 25))
          break;
      }
      return jobs;
    };

    let jobs: Record<string, unknown>[];
    try {
      jobs = await collectPages(true, keyword || undefined);
    } catch (error) {
      // Jobgether returns 400 for unknown taxonomy values. Retry without
      // structured filters and let the local eligibility filter decide.
      if (!(error instanceof Error) || !error.message.startsWith("SOURCE_HTTP_400")) throw error;
      jobs = await collectPages(false, fallbackKeyword || undefined);
    }
    // Valid filters can still produce an empty page. Retry with a title/skill
    // keyword, then a broad first page so the local filter can make the final
    // decision instead of incorrectly reporting zero provider results.
    if (!jobs.length && fallbackKeyword && fallbackKeyword !== keyword)
      jobs = await collectPages(false, fallbackKeyword);
    if (!jobs.length) jobs = await collectPages(false);

    return jobs.flatMap((job) => {
      const postedAt = ["postedAt", "publishedAt", "datePosted", "createdAt", "date"]
        .map((key) => job[key])
        .find((value): value is string => typeof value === "string" && value.trim().length > 0);
      if (
        cutoff !== undefined &&
        (!postedAt || Number.isNaN(Date.parse(postedAt)) || Date.parse(postedAt) < cutoff)
      )
        return [];
      const id = typeof job.id === "string" ? job.id : undefined;
      const titleValue = typeof job.title === "string" ? job.title : "";
      const company = typeof job.company === "string" ? job.company : "";
      const url = typeof job.url === "string" ? job.url : undefined;
      const description = ["description", "jobDescription", "job_description", "summary", "content"]
        .map((key) => job[key])
        .find((value): value is string => typeof value === "string" && value.trim().length > 0);
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
