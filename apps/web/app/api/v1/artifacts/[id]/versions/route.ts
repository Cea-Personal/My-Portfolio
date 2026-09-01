import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const { data: artifact } = await client
      .schema("app")
      .from("generated_artifacts")
      .select("id")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (!artifact) return apiResponse([], request);
    const { data, error } = await client
      .schema("app")
      .from("artifact_versions")
      .select("*")
      .eq("artifact_id", id)
      .order("version", { ascending: false });
    if (error) throw error;
    return apiResponse(data ?? [], request);
  });
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id: artifactId } = await params;
    const { data: artifact } = await client
      .schema("app")
      .from("generated_artifacts")
      .select("id")
      .eq("id", artifactId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (!artifact) return apiResponse(null, request, 404);
    const body = await request.json().catch(() => ({}));
    const { data, error } = await client
      .schema("app")
      .from("artifact_versions")
      .insert({
        artifact_id: artifactId,
        version: Number.isInteger(body.version) ? body.version : 1,
        status: "draft",
        media_type: typeof body.mediaType === "string" ? body.mediaType : null,
        content_manifest_hash:
          typeof body.contentManifestHash === "string" ? body.contentManifestHash : null,
        renderer_version: typeof body.rendererVersion === "string" ? body.rendererVersion : null
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("ARTIFACT_VERSION_CREATE_FAILED");
    return apiResponse(data, request, 201);
  });
}
