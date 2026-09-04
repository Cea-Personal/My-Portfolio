import { coordinateTask } from "@career-os/ai";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    if (
      typeof body.task !== "string" ||
      typeof body.relatedId !== "string" ||
      typeof body.relatedType !== "string"
    )
      return apiResponse({ code: "INVALID_COORDINATED_TASK" }, request, 400);
    let classification;
    try {
      classification = coordinateTask(body.task);
    } catch {
      return apiResponse({ code: "COORDINATED_TASK_NOT_ALLOWED" }, request, 400);
    }
    if (classification.consequential && body.ownerApproval !== true)
      return apiResponse({ code: "OWNER_APPROVAL_REQUIRED", status: "draft" }, request, 409);
    const idempotencyKey =
      typeof body.idempotencyKey === "string"
        ? body.idempotencyKey
        : `orchestrator:${classification.task}:${body.relatedId}`;
    const { data, error } = await client
      .schema("app")
      .from("automation_runs")
      .insert({
        owner_id: ownerId,
        workflow_name: classification.task,
        workflow_version: 1,
        status: "pending",
        correlation_id: crypto.randomUUID(),
        idempotency_key: idempotencyKey.slice(0, 128),
        context_metadata: {
          resourceType: body.relatedType.slice(0, 80),
          resourceId: body.relatedId
        }
      })
      .select("id,workflow_name,workflow_version,status,correlation_id,created_at")
      .single();
    if (error || !data) throw error ?? new Error("COORDINATED_RUN_CREATE_FAILED");
    return apiResponse(
      {
        run: data,
        classification,
        next:
          classification.execution === "reasoning"
            ? "provider_configuration_check"
            : "durable_handler"
      },
      request,
      202
    );
  });
}
