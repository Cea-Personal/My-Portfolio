import { inngest } from "@/inngest/client";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { createPrivateObjectKey, sha256 } from "@career-os/documents";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, correlationId, ownerId }) => {
    const { id } = await params;
    const { data: document, error } = await client
      .schema("app")
      .from("documents")
      .select("id,name,source_mime")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) throw error;
    if (!document) return apiResponse({ code: "DOCUMENT_NOT_FOUND" }, request, 404);

    const objectKey = createPrivateObjectKey(ownerId, id, 1);
    const { data: object, error: downloadError } = await client.storage
      .from("private-documents")
      .download(objectKey);
    if (downloadError || !object)
      return apiResponse(
        { code: "UPLOAD_MISSING", detail: "The signed upload was not found." },
        request,
        409
      );

    const hash = sha256(new Uint8Array(await object.arrayBuffer()));
    const { data: version, error: versionError } = await client
      .schema("app")
      .from("document_versions")
      .insert({
        document_id: id,
        export_mime: document.source_mime,
        internal_sha256: hash,
        download_status: "uploaded",
        storage_object_path: objectKey
      })
      .select("id")
      .single();
    if (versionError || !version) throw versionError ?? new Error("DOCUMENT_VERSION_CREATE_FAILED");
    const { error: statusError } = await client
      .schema("app")
      .from("documents")
      .update({ availability: "available" })
      .eq("id", id)
      .eq("owner_id", ownerId);
    if (statusError) throw statusError;

    const operationKey = request.headers.get("idempotency-key") ?? `document:${id}:${hash}`;
    const { data: run, error: runError } = await client
      .schema("app")
      .from("ingestion_runs")
      .insert({
        owner_id: ownerId,
        trigger: "document_upload",
        correlation_id: correlationId,
        idempotency_key: `ingest:${version.id}`,
        status: "pending"
      })
      .select("id")
      .single();
    if (runError || !run) throw runError ?? new Error("INGESTION_RUN_CREATE_FAILED");
    const { error: itemError } = await client.schema("app").from("ingestion_items").insert({
      run_id: run.id,
      document_id: id,
      document_version_id: version.id,
      stage: "queued",
      status: "pending",
      attempts: 0
    });
    if (itemError) throw itemError;
    try {
      await inngest.send({
        name: "career/document.changed.v1",
        id: `${ownerId}:${id}:${hash}`,
        data: {
          schemaVersion: 1,
          ownerId,
          correlationId,
          resourceType: "document",
          resourceId: id,
          operationKey,
          requestedBy: "owner",
          metadata: { documentVersionId: version.id, ingestionRunId: run.id }
        }
      });
    } catch {
      await client
        .schema("app")
        .from("ingestion_runs")
        .update({
          status: "failed",
          error_summary: "WORKFLOW_DISPATCH_FAILED",
          finished_at: new Date().toISOString()
        })
        .eq("id", run.id)
        .eq("owner_id", ownerId);
      await client
        .schema("app")
        .from("ingestion_items")
        .update({
          status: "failed",
          sanitized_error: "WORKFLOW_DISPATCH_FAILED",
          finished_at: new Date().toISOString()
        })
        .eq("run_id", run.id)
        .eq("document_id", id);
      return apiResponse(
        {
          code: "INGESTION_DISPATCH_FAILED",
          detail: "The file was uploaded, but automatic indexing could not be started."
        },
        request,
        503
      );
    }
    return apiResponse(
      {
        documentId: id,
        documentVersionId: version.id,
        filename: document.name,
        status: "indexing",
        ingestionRunId: run.id
      },
      request,
      201
    );
  });
}
