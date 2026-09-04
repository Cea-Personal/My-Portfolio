import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const { data: version } = await client
      .schema("app")
      .from("artifact_versions")
      .select("id,artifact_id,status,binary_hash")
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
    if (version.status !== "final" || !version.binary_hash)
      return apiResponse({ code: "FINAL_ARTIFACT_REQUIRED" }, request, 409);
    const { data, error } = await client
      .schema("app")
      .from("artifact_submitted_snapshots")
      .insert({ artifact_version_id: id, owner_id: ownerId, snapshot_hash: version.binary_hash })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("SUBMITTED_SNAPSHOT_FAILED");
    const updated = await client
      .schema("app")
      .from("artifact_versions")
      .update({ status: "submitted_snapshot" })
      .eq("id", id)
      .eq("artifact_id", version.artifact_id);
    if (updated.error) throw updated.error;
    return apiResponse({ status: "submitted_snapshot", snapshot: data }, request);
  });
}
