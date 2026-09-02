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
        metadata: { documentVersionId: version.id }
      }
    });
    return apiResponse(
      {
        documentId: id,
        documentVersionId: version.id,
        filename: document.name,
        status: "uploaded"
      },
      request,
      201
    );
  });
}
