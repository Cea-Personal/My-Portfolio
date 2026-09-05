import { inngest } from "@/inngest/client";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, correlationId, ownerId }) => {
    const operationKey = request.headers.get("idempotency-key");
    if (!operationKey) return apiResponse({ code: "IDEMPOTENCY_REQUIRED" }, request, 400);

    const { id } = await params;
    const { data: document, error: documentError } = await client
      .schema("app")
      .from("documents")
      .select(
        "id,parent_path,document_versions(id,storage_object_path,evidence_version_id,created_at)"
      )
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (documentError) throw documentError;
    if (!document) return apiResponse({ code: "DOCUMENT_NOT_FOUND" }, request, 404);

    const versions = Array.isArray(document.document_versions)
      ? [...document.document_versions].sort((left, right) =>
          String(right.created_at).localeCompare(String(left.created_at))
        )
      : [];
    const version = versions[0];
    if (!version)
      return apiResponse(
        { code: "DOCUMENT_VERSION_NOT_FOUND", detail: "Upload the document binary first." },
        request,
        409
      );
    const objectPath = version.storage_object_path ?? document.parent_path;
    if (!objectPath)
      return apiResponse(
        { code: "DOCUMENT_OBJECT_PATH_MISSING", detail: "Re-upload this document." },
        request,
        409
      );
    const { error: objectError } = await client.storage
      .from("private-documents")
      .download(objectPath);
    if (objectError)
      return apiResponse(
        { code: "DOCUMENT_OBJECT_MISSING", detail: "Re-upload this document." },
        request,
        409
      );

    const { data: run, error: runError } = await client
      .schema("app")
      .from("ingestion_runs")
      .insert({
        owner_id: ownerId,
        trigger: "manual_reprocess",
        correlation_id: correlationId,
        idempotency_key: operationKey,
        status: "pending"
      })
      .select("id,status")
      .single();
    if (runError || !run) throw runError ?? new Error("INGESTION_RUN_CREATE_FAILED");

    try {
      await inngest.send({
        name: "career/document.changed.v1",
        id: `${ownerId}:${id}:${operationKey}`,
        data: {
          schemaVersion: 1,
          ownerId,
          correlationId,
          resourceType: "document",
          resourceId: id,
          operationKey,
          requestedBy: "owner",
          metadata: {
            documentVersionId: version.id,
            ingestionRunId: run.id,
            forceExtraction: true
          }
        }
      });
    } catch {
      await client
        .schema("app")
        .from("ingestion_runs")
        .update({
          status: "failed",
          error_summary: "EVENT_DISPATCH_FAILED",
          finished_at: new Date().toISOString()
        })
        .eq("id", run.id)
        .eq("owner_id", ownerId);
      return apiResponse(
        {
          code: "INGESTION_DISPATCH_FAILED",
          detail: "The indexing event could not be dispatched. Check the Inngest configuration."
        },
        request,
        503
      );
    }

    return apiResponse({ runId: run.id, status: "pending" }, request, 202);
  });
}
