import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

function display(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const load = async (table: string, columns: string, limit = 100) => {
      const result = await client
        .schema("app")
        .from(table)
        .select(columns)
        .eq("owner_id", ownerId)
        .limit(limit);
      return result.error ? [] : ((result.data ?? []) as unknown as Record<string, unknown>[]);
    };
    const [facts, runs, jobs, applications, stages, projections, posts] = await Promise.all([
      load("career_facts", "id, review_status, visibility, updated_at", 100),
      load("automation_runs", "id, workflow_name, status, created_at", 100),
      load("jobs", "id, canonical_title, canonical_company, status, discovered_at", 100),
      load("applications", "id, status, created_at", 100),
      load("interview_stages", "id, name, status, scheduled_at", 100),
      load(
        "portfolio_projection_rules",
        "id, source_entity_type, public_eligible, updated_at",
        100
      ),
      load("posts", "id, slug, status, created_at", 100)
    ]);
    const pendingFacts = facts.filter((fact) =>
      ["candidate", "in_review", "deferred"].includes(String(fact.review_status))
    );
    const activeJobs = jobs.filter((job) =>
      ["discovered", "reviewing", "interested"].includes(String(job.status))
    );
    const awaitingApplications = applications.filter((application) =>
      ["draft", "preparing", "ready_to_apply"].includes(String(application.status))
    );
    const upcomingInterviews = stages.filter((stage) =>
      ["planned", "scheduled"].includes(String(stage.status))
    );
    const draftPosts = posts.filter((post) => String(post.status) === "draft");
    const actions = [
      ...pendingFacts.slice(0, 5).map((fact) => ({
        type: "fact_review",
        label: "Review career fact",
        href: `/career-brain/${String(fact.id)}`
      })),
      ...activeJobs.slice(0, 5).map((job) => ({
        type: "job",
        label: `${display(job.canonical_title, "Role")} at ${display(job.canonical_company, "Company")}`,
        href: `/jobs/${display(job.id, "")}`
      })),
      ...awaitingApplications.slice(0, 5).map((application) => ({
        type: "application",
        label: "Continue application workspace",
        href: `/applications/${display(application.id, "")}`
      }))
    ];
    return apiResponse(
      {
        actions,
        counts: {
          highFitJobs: activeJobs.length,
          applicationsAwaitingAction: awaitingApplications.length,
          upcomingInterviews: upcomingInterviews.length,
          pendingPreparation: upcomingInterviews.filter((stage) => !stage.scheduled_at).length,
          reviewableFacts: pendingFacts.length,
          portfolioActivity: projections.length,
          draftContent: draftPosts.length
        },
        summary: { facts: facts.slice(0, 5), runs: runs.slice(0, 5) }
      },
      request
    );
  });
}
