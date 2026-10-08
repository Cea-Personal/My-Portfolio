import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { buildDashboardActions } from "@/lib/dashboard-actions";

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const unavailable: string[] = [];
    const load = async (
      table: string,
      columns: string,
      label: string,
      order: string,
      limit = 500,
      schema = "app"
    ) => {
      const result = await client
        .schema(schema)
        .from(table)
        .select(columns)
        .eq("owner_id", ownerId)
        .order(order, { ascending: false })
        .limit(limit);
      if (result.error) {
        unavailable.push(label);
        return [];
      }
      return (result.data ?? []) as unknown as Record<string, unknown>[];
    };
    const [
      jobs,
      applications,
      processes,
      opportunities,
      scores,
      proposals,
      facts,
      publications,
      debriefs
    ] = await Promise.all([
      load(
        "jobs",
        "id, canonical_title, canonical_company, status, opportunity_domain, discovered_at, job_scores(score_type, numeric_score, created_at)",
        "job matches",
        "discovered_at"
      ),
      load(
        "applications",
        "id, job_id, status, applied_at, created_at, application_kind, jobs(canonical_title, canonical_company)",
        "applications",
        "created_at"
      ),
      // Stages have no owner_id: scope through their owner's interview process.
      load(
        "interview_processes",
        "id, applications(jobs(canonical_title, canonical_company)), interview_stages(id, name, status, scheduled_at, preparation_kits(id, status))",
        "interviews",
        "created_at",
        200
      ),
      load(
        "freelance_opportunities",
        "id, job_id, created_at",
        "freelance opportunities",
        "created_at"
      ),
      load(
        "freelance_opportunity_scores",
        "opportunity_id, recommendation, total_score, created_at",
        "freelance scores",
        "created_at",
        1000
      ),
      load(
        "freelance_proposals",
        "id, opportunity_id, approval_state, crm_status, updated_at",
        "proposals",
        "updated_at"
      ),
      load(
        "career_facts",
        "id, review_status, currentVersion:career_fact_versions!career_facts_current_version_fk(statement)",
        "career evidence",
        "updated_at"
      ),
      load(
        "portfolio_publications",
        "id, version, status, created_at",
        "portfolio approvals",
        "created_at",
        100,
        "published"
      ),
      load(
        "interview_debriefs",
        "id, stage_id, follow_ups, created_at",
        "interview follow-ups",
        "created_at",
        200
      )
    ]);
    return apiResponse(
      {
        ...buildDashboardActions({
          jobs,
          applications,
          processes,
          opportunities,
          scores,
          proposals,
          facts,
          publications,
          debriefs
        }),
        unavailable,
        scope: "Recent records; open each workspace for full history."
      },
      request
    );
  });
}
