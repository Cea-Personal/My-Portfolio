import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { inngest } from "@/inngest/client";
const eventForWorkflow: Record<string, string> = {
  drive_sync: "career/drive.sync.requested.v1",
  ingestion: "career/document.parse.requested.v1",
  job_search: "career/job-search.requested.v1",
  artifact_draft: "career/application.artifact.requested.v1",
  analytics_aggregate: "career/analytics.aggregate.requested.v1",
  export: "career/export.requested.v1",
  evidence_extraction: "career/facts.extract.requested.v1",
  document_composition: "career/application.artifact.requested.v1",
  compensation: "career/compensation.research.requested.v1",
  interview_preparation: "career/interview-kit.requested.v1",
  writing_assistance: "career/post.assistance.requested.v1"
};
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const prior = await client
      .schema("app")
      .from("automation_runs")
      .select(
        "id,workflow_name,workflow_version,status,correlation_id,idempotency_key,retry_count,context_metadata"
      )
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (prior.error) throw prior.error;
    if (!prior.data || !["failed", "partial", "cancelled"].includes(prior.data.status))
      return apiResponse({ code: "RUN_NOT_RESUMABLE" }, request, 409);
    const eventName = prior.data.workflow_name.startsWith("career/")
      ? prior.data.workflow_name
      : eventForWorkflow[prior.data.workflow_name];
    if (!eventName) return apiResponse({ code: "WORKFLOW_HANDLER_NOT_REGISTERED" }, request, 409);
    const context = prior.data.context_metadata as Record<string, unknown>;
    if (typeof context.resourceType !== "string" || typeof context.resourceId !== "string")
      return apiResponse({ code: "RUN_CONTEXT_UNAVAILABLE" }, request, 409);
    const retryCount = Number(prior.data.retry_count ?? 0) + 1;
    if (retryCount > 5) return apiResponse({ code: "RETRY_LIMIT_REACHED" }, request, 409);
    const operationKey = `${String(prior.data.idempotency_key).slice(0, 100)}:retry:${String(retryCount)}`;
    const correlationId = crypto.randomUUID();
    const created = await client
      .schema("app")
      .from("automation_runs")
      .insert({
        owner_id: ownerId,
        workflow_name: prior.data.workflow_name,
        workflow_version: prior.data.workflow_version,
        status: "pending",
        correlation_id: correlationId,
        idempotency_key: operationKey,
        retry_count: retryCount,
        resumed_from_id: prior.data.id,
        context_metadata: context
      })
      .select("id,workflow_name,status,retry_count,resumed_from_id,created_at")
      .single();
    if (created.error || !created.data) throw created.error ?? new Error("RUN_RESUME_FAILED");
    try {
      await inngest.send({
        id: `resume-${created.data.id}`,
        name: eventName,
        data: {
          schemaVersion: 1,
          ownerId,
          correlationId,
          causationId: prior.data.id,
          resourceType: context.resourceType,
          resourceId: context.resourceId,
          operationKey,
          requestedBy: "owner",
          metadata: { automationRunId: created.data.id }
        }
      });
    } catch (error) {
      await client
        .schema("app")
        .from("automation_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error_code: "DISPATCH_FAILED"
        })
        .eq("id", created.data.id);
      throw error;
    }
    return apiResponse({ status: "pending", run: created.data }, request, 202);
  });
}
