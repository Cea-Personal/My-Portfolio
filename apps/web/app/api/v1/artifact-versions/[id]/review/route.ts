import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { data: version } = await client
      .schema("app")
      .from("artifact_versions")
      .select("id,artifact_id,status,evidence_ids")
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
    const decision = body.decision === "rejected" ? "rejected" : "approved";
    if (decision === "approved" && (!version.evidence_ids || version.evidence_ids.length < 1))
      return apiResponse({ code: "ARTIFACT_EVIDENCE_REQUIRED" }, request, 409);
    const { error } = await client
      .schema("app")
      .from("artifact_reviews")
      .insert({
        artifact_version_id: id,
        owner_id: ownerId,
        decision,
        notes: typeof body.notes === "string" ? body.notes.slice(0, 2000) : null
      });
    if (error) throw error;
    const status =
      decision === "rejected" ? "rejected" : body.markFinal === true ? "final" : "owner_reviewed";
    if (status === "final") {
      const supersede = await client
        .schema("app")
        .from("artifact_versions")
        .update({ status: "superseded" })
        .eq("artifact_id", version.artifact_id)
        .eq("status", "final")
        .neq("id", id);
      if (supersede.error) throw supersede.error;
    }
    const update = await client
      .schema("app")
      .from("artifact_versions")
      .update({ status })
      .eq("id", id)
      .eq("artifact_id", version.artifact_id);
    if (update.error) throw update.error;
    return apiResponse({ status, artifactVersionId: id }, request);
  });
}
