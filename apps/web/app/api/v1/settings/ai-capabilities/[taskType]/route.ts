import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
const taskTypes = new Set([
  "public_qa",
  "role_fit",
  "evidence_extraction",
  "career_gap",
  "job_scoring",
  "document_composition",
  "compensation",
  "interview_preparation",
  "writing_assistance",
  "portfolio_analytics",
  "embedding",
  "orchestrator"
]);
interface AvailableProvider {
  id: string;
  capabilities: string[];
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskType: string }> }
) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { taskType } = await params;
    const body = await request.json().catch(() => ({}));
    if (!taskTypes.has(taskType) || typeof body.providerId !== "string")
      return apiResponse({ code: "INVALID_CAPABILITY_CONFIGURATION" }, request, 400);
    const creativity = Number(body.creativity ?? 0.2);
    const lengthLimit = Number(body.lengthLimit ?? 2000);
    const timeoutMs = Number(body.timeoutMs ?? (taskType === "orchestrator" ? 120000 : 30000));
    const retryLimit = Number(body.retryLimit ?? 2);
    if (
      !Number.isFinite(creativity) ||
      creativity < 0 ||
      creativity > 1 ||
      !Number.isInteger(lengthLimit) ||
      lengthLimit < 128 ||
      lengthLimit > 32000 ||
      !Number.isInteger(timeoutMs) ||
      timeoutMs < 1000 ||
      timeoutMs > 120000 ||
      !Number.isInteger(retryLimit) ||
      retryLimit < 0 ||
      retryLimit > 5
    )
      return apiResponse({ code: "INVALID_CAPABILITY_LIMITS" }, request, 400);
    const providers = await client.schema("app").rpc("list_available_ai_providers");
    if (providers.error) throw providers.error;
    const available = (providers.data ?? []) as AvailableProvider[];
    const provider = available.find((item) => item.id === body.providerId);
    const fallback =
      typeof body.fallbackProviderId === "string"
        ? available.find((item) => item.id === body.fallbackProviderId)
        : null;
    const supports = (item: typeof provider) =>
      Boolean(
        item?.capabilities?.some(
          (capability: string) =>
            capability === "*" ||
            capability === taskType ||
            (taskType === "embedding" && capability === "embeddings") ||
            (taskType !== "embedding" && capability === "reasoning") ||
            (taskType === "orchestrator" && capability !== "embeddings")
        )
      );
    if (
      !provider ||
      !supports(provider) ||
      (body.fallbackProviderId && (!fallback || !supports(fallback))) ||
      body.fallbackProviderId === body.providerId
    )
      return apiResponse({ code: "PROVIDER_COMBINATION_UNAVAILABLE" }, request, 409);
    const { data, error } = await client
      .schema("app")
      .from("ai_capability_configs")
      .upsert(
        {
          owner_id: ownerId,
          task_type: taskType,
          provider_config_id: body.providerId,
          fallback_provider_config_id: fallback?.id ?? null,
          model_class: ["fast", "balanced", "deep"].includes(body.modelClass)
            ? body.modelClass
            : "balanced",
          creativity,
          length_limit: lengthLimit,
          timeout_ms: timeoutMs,
          retry_limit: retryLimit,
          enabled: body.enabled === true,
          updated_at: new Date().toISOString()
        },
        { onConflict: "owner_id,task_type" }
      )
      .select(
        "task_type,model_class,creativity,length_limit,timeout_ms,retry_limit,enabled,updated_at"
      )
      .single();
    if (error) throw error;
    return apiResponse(data, request);
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ taskType: string }> }
) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { taskType } = await params;
    if (!taskTypes.has(taskType))
      return apiResponse({ code: "INVALID_CAPABILITY_CONFIGURATION" }, request, 400);
    const { data, error } = await client
      .schema("app")
      .from("ai_capability_configs")
      .delete()
      .eq("owner_id", ownerId)
      .eq("task_type", taskType)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return apiResponse({ deleted: Boolean(data), taskType }, request, data ? 200 : 404);
  });
}
