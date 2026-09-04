import { countBy, parseAnalyticsFilters } from "@/lib/analytics-filters";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
interface Score {
  score_type: string;
  numeric_score: number;
  created_at: string;
}
interface SourceRef {
  source_id: string;
}
interface Job {
  id: string;
  canonical_title: string;
  country: string | null;
  remote_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  status: string;
  job_scores?: Score[];
  job_source_references?: SourceRef[];
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
    let query = client
      .schema("app")
      .from("applications")
      .select(
        "id,status,created_at,applied_at,closed_at,jobs!inner(id,canonical_title,country,remote_type,salary_min,salary_max,status,job_scores(score_type,numeric_score,created_at),job_source_references(source_id))"
      )
      .eq("owner_id", ownerId)
      .limit(5000);
    if (filters.from) query = query.gte("created_at", filters.from);
    if (filters.to) query = query.lte("created_at", filters.to);
    const result = await query;
    if (result.error) throw result.error;
    const latestScore = (scores: Score[] | undefined, type: string) =>
      [...(scores ?? [])]
        .filter((score) => score.score_type === type)
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]?.numeric_score ??
      null;
    const rows = (result.data ?? [])
      .map((row) => {
        const job = row.jobs as unknown as Job;
        return {
          id: row.id as string,
          status: row.status as string,
          createdAt: row.created_at as string,
          appliedAt: row.applied_at as string | null,
          job,
          matchScore: latestScore(job.job_scores, "match"),
          opportunityScore: latestScore(job.job_scores, "opportunity")
        };
      })
      .filter((row) => {
        const midpoint = ((row.job.salary_min ?? 0) + (row.job.salary_max ?? 0)) / 2;
        return (
          (!filters.role ||
            row.job.canonical_title.toLowerCase().includes(filters.role.toLowerCase())) &&
          (!filters.country || row.job.country?.toLowerCase() === filters.country.toLowerCase()) &&
          (!filters.workModel ||
            row.job.remote_type?.toLowerCase() === filters.workModel.toLowerCase()) &&
          (!filters.source ||
            row.job.job_source_references?.some((source) => source.source_id === filters.source)) &&
          (filters.minMatch === undefined || (row.matchScore ?? -1) >= filters.minMatch) &&
          (filters.minOpportunity === undefined ||
            (row.opportunityScore ?? -1) >= filters.minOpportunity) &&
          (filters.minComp === undefined || midpoint >= filters.minComp) &&
          (filters.maxComp === undefined || midpoint <= filters.maxComp)
        );
      });
    const funnel = countBy(rows.map((row) => row.status));
    const reconciliation = rows
      .filter((row) => {
        const jobApplied = [
          "applied",
          "recruiter_contact",
          "interview",
          "technical_assessment",
          "final_interview",
          "offer",
          "rejected"
        ].includes(row.job.status);
        const applicationApplied =
          Boolean(row.appliedAt) ||
          ["submitted", "interviewing", "offer", "rejected", "withdrawn"].includes(row.status);
        return jobApplied !== applicationApplied;
      })
      .map((row) => ({
        applicationId: row.id,
        applicationStatus: row.status,
        jobStatus: row.job.status,
        action: "Reconcile the job and application lifecycle history."
      }));
    const progressed = rows.filter((row) => ["interviewing", "offer"].includes(row.status)).length;
    return apiResponse(
      {
        rows,
        funnel,
        totals: {
          applications: rows.length,
          progressed,
          conversionRate: rows.length >= 3 ? progressed / rows.length : null
        },
        lowData: rows.length < 3,
        reconciliation,
        filters,
        calculationVersion: "analytics.v2"
      },
      request
    );
  });
}
