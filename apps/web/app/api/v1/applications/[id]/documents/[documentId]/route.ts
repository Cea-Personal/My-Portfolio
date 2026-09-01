import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id: applicationId, documentId } = await params;
    const { data, error } = await client
      .schema("app")
      .from("application_documents")
      .update({ removed_at: new Date().toISOString(), availability: "unavailable" })
      .eq("id", documentId)
      .eq("application_id", applicationId)
      .eq("owner_id", ownerId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return apiResponse({ removed: Boolean(data) }, request, data ? 200 : 404);
  });
}
