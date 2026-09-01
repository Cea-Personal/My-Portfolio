import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const { data, error } = await client
      .schema("app")
      .from("generated_artifacts")
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
      .from("generated_artifacts")
      .insert({
        owner_id: ownerId,
        application_id: applicationId,
        artifact_type: typeof body.artifactType === "string" ? body.artifactType : "document",
        title: typeof body.title === "string" ? body.title.slice(0, 200) : "Draft artifact"
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("ARTIFACT_CREATE_FAILED");
    return apiResponse(data, request, 201);
  });
}
