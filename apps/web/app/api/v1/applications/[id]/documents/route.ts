import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const { data, error } = await client
      .schema("app")
      .from("application_documents")
      .select("*")
      .eq("application_id", id)
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return apiResponse(data ?? [], request);
  });
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id: applicationId } = await params;
    const body = await request.json().catch(() => ({}));
    const { data, error } = await client
      .schema("app")
      .from("application_documents")
      .insert({
        application_id: applicationId,
        owner_id: ownerId,
        document_kind: typeof body.documentKind === "string" ? body.documentKind : "supporting",
        source_type: typeof body.sourceType === "string" ? body.sourceType : "upload",
        source_url: typeof body.sourceUrl === "string" ? body.sourceUrl : null,
        original_filename: typeof body.filename === "string" ? body.filename.slice(0, 255) : null,
        media_type: typeof body.mediaType === "string" ? body.mediaType : null,
        availability: "available"
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("APPLICATION_DOCUMENT_CREATE_FAILED");
    return apiResponse(data, request, 201);
  });
}
