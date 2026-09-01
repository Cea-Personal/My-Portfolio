import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { data: version } = await client
      .schema("app")
      .from("artifact_versions")
      .select("id, artifact_id")
      .eq("id", id)
      .maybeSingle();
    if (!version) return apiResponse(null, request, 404);
    const { data: artifact } = await client
      .schema("app")
      .from("generated_artifacts")
      .select("id")
      .eq("id", version.artifact_id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (!artifact) return apiResponse(null, request, 404);
    const { error } = await client
      .schema("app")
      .from("artifact_reviews")
      .insert({
        artifact_version_id: id,
        owner_id: ownerId,
        decision: body.decision === "rejected" ? "rejected" : "approved",
        notes: typeof body.notes === "string" ? body.notes.slice(0, 2000) : null
      });
    if (error) throw error;
    return apiResponse({ status: "owner_reviewed", artifactVersionId: id }, request);
  });
}
