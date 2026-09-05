import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("documents")
      .select(
        "id,name,source_mime,document_kind,classification_confidence,classification_reason,availability,created_at,document_versions(download_status,evidence_version_id,created_at),ingestion_items(status,stage,sanitized_error,started_at,finished_at)"
      )
      .eq("owner_id", ownerId)
      .is("duplicate_of_id", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return apiResponse(data ?? [], request);
  });
}
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    if (typeof body.name !== "string" || typeof body.mimeType !== "string")
      return apiResponse(
        { code: "INVALID_DOCUMENT", detail: "name and mimeType are required" },
        request,
        400
      );
    const { data, error } = await client
      .schema("app")
      .from("documents")
      .insert({
        owner_id: ownerId,
        name: body.name.slice(0, 255),
        source_mime: body.mimeType,
        external_file_id: typeof body.externalFileId === "string" ? body.externalFileId : null
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("DOCUMENT_CREATE_FAILED");
    return apiResponse(data, request, 201);
  });
}
