import { countBy, parseAnalyticsFilters } from "@/lib/analytics-filters";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

interface JobScore {
  score_type: string;
  numeric_score: number | string;
  created_at: string;
}

interface JobSourceReference {
  source_id: string;
  source_status?: string | null;
}

interface JobRow {
  id: string;
  canonical_title: string;
  canonical_company: string;
  country?: string | null;
  remote_type?: string | null;
  salary_min?: number | string | null;
  salary_max?: number | string | null;
  current_description?: string | null;
  status: string;
  discovered_at: string;
  source_provider?: string | null;
  discovery_source?: string | null;
  discovery_eligibility?: string | null;
  discovery_search_run_id?: string | null;
  job_scores?: JobScore[];
  job_source_references?: JobSourceReference[];
}

interface SearchRunSource {
  source_id: string;
  status: string;
  fetched_count?: number | null;
  accepted_count?: number | null;
  rejected_count?: number | null;
  sanitized_error?: string | null;
}

interface SearchRun {
  id: string;
  status: string;
  trigger_type: string;
  logical_date: string;
  started_at?: string | null;
  finished_at?: string | null;
  result_counts?: Record<string, unknown> | null;
  error_summary?: string | null;
  job_search_run_sources?: SearchRunSource[];
}

interface Source {
  id: string;
  name: string;
  adapter_type: string;
}

function numeric(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function latestScore(job: JobRow, type: string): number | null {
  return (
    [...(job.job_scores ?? [])]
      .filter((score) => score.score_type === type)
      .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
      .map((score) => numeric(score.numeric_score))
      .find((score): score is number => score !== null) ?? null
  );
}

function resultCount(run: SearchRun, key: string): number {
  const value = run.result_counts?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    let filters;
    try {
      filters = parseAnalyticsFilters(request, [
        "role",
        "country",
        "source",
        "workModel",
        "minMatch",
        "minOpportunity",
        "minComp",
        "maxComp",
        "from",
        "to"
      ]);
    } catch (error) {
      return apiResponse(
        { code: error instanceof Error ? error.message : "INVALID_FILTER" },
        request,
        400
      );
    }

    let jobQuery = client
      .schema("app")
      .from("jobs")
      .select(
        "id,canonical_title,canonical_company,country,remote_type,salary_min,salary_max,current_description,status,discovered_at,source_provider,discovery_source,discovery_eligibility,discovery_search_run_id,job_scores(score_type,numeric_score,created_at),job_source_references(source_id,source_status)"
      )
      .eq("owner_id", ownerId)
      .limit(5000);
    if (filters.from) jobQuery = jobQuery.gte("discovered_at", filters.from);
    if (filters.to) jobQuery = jobQuery.lte("discovered_at", filters.to);

    let runQuery = client
      .schema("app")
      .from("job_search_runs")
      .select(
        "id,status,trigger_type,logical_date,started_at,finished_at,result_counts,error_summary,job_search_run_sources(source_id,status,fetched_count,accepted_count,rejected_count,sanitized_error)"
      )
      .eq("owner_id", ownerId)
      .order("logical_date", { ascending: false })
      .limit(5000);
    if (filters.from) runQuery = runQuery.gte("logical_date", filters.from.slice(0, 10));
    if (filters.to) runQuery = runQuery.lte("logical_date", filters.to.slice(0, 10));

    const [jobResult, runResult, sourceResult] = await Promise.all([
      jobQuery,
      runQuery,
      client.schema("app").from("job_sources").select("id,name,adapter_type").eq("owner_id", ownerId)
    ]);
    if (jobResult.error) throw jobResult.error;
    if (runResult.error) throw runResult.error;
    if (sourceResult.error) throw sourceResult.error;

    const sourceById = new Map(
      ((sourceResult.data ?? []) as unknown as Source[]).map((source) => [source.id, source])
    );
    const jobs = (jobResult.data ?? []) as unknown as JobRow[];
    const rows = jobs.filter((job) => {
      const midpoint =
        ((numeric(job.salary_min) ?? 0) + (numeric(job.salary_max) ?? 0)) / 2;
      return (
        (!filters.role || job.canonical_title.toLowerCase().includes(filters.role.toLowerCase())) &&
        (!filters.country || job.country?.toLowerCase() === filters.country.toLowerCase()) &&
        (!filters.workModel || job.remote_type?.toLowerCase() === filters.workModel.toLowerCase()) &&
        (!filters.source ||
          job.job_source_references?.some((source) => source.source_id === filters.source)) &&
        (filters.minMatch === undefined || (latestScore(job, "match") ?? -1) >= filters.minMatch) &&
        (filters.minOpportunity === undefined ||
          (latestScore(job, "opportunity") ?? -1) >= filters.minOpportunity) &&
        (filters.minComp === undefined || midpoint >= filters.minComp) &&
        (filters.maxComp === undefined || midpoint <= filters.maxComp)
      );
    });
    const runs = (runResult.data ?? []) as unknown as SearchRun[];
    const activeStatuses = new Set([
      "discovered",
      "shortlisted",
      "interested",
      "preparing_application",
      "ready_to_apply",
      "applied",
      "recruiter_contact",
      "interview",
      "technical_assessment",
      "final_interview",
      "offer"
    ]);
    const sourceLabels = rows.flatMap((job) => {
      const references = job.job_source_references ?? [];
      if (!references.length) return [job.source_provider || job.discovery_source || "manual"];
      return references.map(
        (reference) => sourceById.get(reference.source_id)?.name || reference.source_id
      );
    });
    const eligibility = rows.map((job) => job.discovery_eligibility || "MANUAL");
    const discoveryByDay = countBy(rows.map((job) => job.discovered_at.slice(0, 10)));
    const runSources = runs.flatMap((run) => run.job_search_run_sources ?? []);
    const sourcePerformance = [...sourceById.values()]
      .map((source) => {
        const sourceRuns = runSources.filter((item) => item.source_id === source.id);
        const sourceJobs = rows.filter((job) =>
          job.job_source_references?.some((reference) => reference.source_id === source.id)
        );
        return {
          id: source.id,
          name: source.name,
          adapterType: source.adapter_type,
          listings: sourceJobs.length,
          fetched: sourceRuns.reduce((total, item) => total + (item.fetched_count ?? 0), 0),
          accepted: sourceRuns.reduce((total, item) => total + (item.accepted_count ?? 0), 0),
          rejected: sourceRuns.reduce((total, item) => total + (item.rejected_count ?? 0), 0),
          failures: sourceRuns.filter((item) => item.status === "failed" || item.sanitized_error).length
        };
      })
      .sort((left, right) => right.listings - left.listings);
    const recentRuns = runs.slice(0, 8).map((run) => ({
      id: run.id,
      status: run.status,
      triggerType: run.trigger_type,
      logicalDate: run.logical_date,
      discovered: resultCount(run, "discovered"),
      persisted: resultCount(run, "persisted"),
      filtered: resultCount(run, "filtered"),
      errorSummary: run.error_summary
    }));

    return apiResponse(
      {
        totals: {
          jobs: rows.length,
          active: rows.filter((job) => activeStatuses.has(job.status)).length,
          rejected: rows.filter((job) => job.status === "rejected").length,
          expired: rows.filter((job) => job.status === "expired").length,
          withDescriptions: rows.filter((job) => Boolean(job.current_description?.trim())).length,
          searchRuns: runs.length,
          failedSearchRuns: runs.filter((run) => run.status === "failed").length
        },
        statusBreakdown: countBy(rows.map((job) => job.status)),
        sourceBreakdown: countBy(sourceLabels),
        eligibilityBreakdown: countBy(eligibility),
        roleBreakdown: countBy(rows.map((job) => job.canonical_title)),
        discoveryByDay,
        searchRunStatus: countBy(runs.map((run) => run.status)),
        searchTriggerTypes: countBy(runs.map((run) => run.trigger_type)),
        sourcePerformance,
        recentRuns,
        filters,
        calculationVersion: "analytics.jobs.v1"
      },
      request
    );
  });
}
