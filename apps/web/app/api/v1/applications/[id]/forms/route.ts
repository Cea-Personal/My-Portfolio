import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id: applicationId } = await params;
    const { data: application } = await client
      .schema("app")
      .from("applications")
      .select("id")
      .eq("id", applicationId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (!application) return apiResponse(null, request, 404);
    const body = await request.json().catch(() => ({}));
    const { data, error } = await client
      .schema("app")
      .from("application_forms")
      .insert({
        application_id: applicationId,
        source_url: typeof body.sourceUrl === "string" ? body.sourceUrl : null,
        access_method: typeof body.accessMethod === "string" ? body.accessMethod : "manual",
        schema_version: "application-form.v1",
        source_hash: typeof body.sourceHash === "string" ? body.sourceHash : crypto.randomUUID()
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("FORM_CREATE_FAILED");
    return apiResponse(data, request, 201);
  });
}
