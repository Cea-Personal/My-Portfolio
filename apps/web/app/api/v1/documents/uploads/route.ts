import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { createPrivateObjectKey, validateUploadMetadata } from "@career-os/documents";

export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = (await request.json().catch(() => null)) as {
      filename?: unknown;
      mediaType?: unknown;
      size?: unknown;
    } | null;
    if (
      !body ||
      typeof body.filename !== "string" ||
      typeof body.mediaType !== "string" ||
      typeof body.size !== "number"
    )
      return apiResponse(
        { code: "INVALID_UPLOAD", detail: "Valid upload metadata is required." },
        request,
        400
      );

    try {
      validateUploadMetadata({
        filename: body.filename,
        mediaType: body.mediaType,
        size: body.size
      });
    } catch (error) {
      return apiResponse(
        {
          code: "INVALID_UPLOAD",
          detail: error instanceof Error ? error.message : "Invalid upload."
        },
        request,
        422
      );
    }

    const documentId = crypto.randomUUID();
    const objectKey = createPrivateObjectKey(ownerId, documentId, 1);
    const { error: documentError } = await client.schema("app").from("documents").insert({
      id: documentId,
      owner_id: ownerId,
      name: body.filename,
      source_mime: body.mediaType,
      parent_path: objectKey,
      availability: "partial"
    });
    if (documentError) throw documentError;

    const { data: signedUpload, error: storageError } = await client.storage
      .from("private-documents")
      .createSignedUploadUrl(objectKey);
    if (storageError || !signedUpload) {
      await client
        .schema("app")
        .from("documents")
        .delete()
        .eq("id", documentId)
        .eq("owner_id", ownerId);
      throw storageError ?? new Error("SIGNED_UPLOAD_UNAVAILABLE");
    }
    return apiResponse(
      {
        documentId,
        objectKey,
        token: signedUpload.token,
        filename: body.filename,
        status: "awaiting_upload"
      },
      request,
      201
    );
  });
}
