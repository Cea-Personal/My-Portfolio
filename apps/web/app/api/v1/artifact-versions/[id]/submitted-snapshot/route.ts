import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
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
    const { data, error } = await client
      .schema("app")
      .from("artifact_submitted_snapshots")
      .insert({ artifact_version_id: id, owner_id: ownerId, snapshot_hash: crypto.randomUUID() })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("SUBMITTED_SNAPSHOT_FAILED");
    return apiResponse({ status: "submitted_snapshot", snapshot: data }, request);
  });
}
