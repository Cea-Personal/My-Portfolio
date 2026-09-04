import { withPrivateApi } from "@/lib/api/private";
import { apiResponse } from "@/lib/api/response";

export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const version = await client
      .schema("app")
      .from("artifact_versions")
      .select("id,storage_key,media_type,artifact_id,generated_artifacts!inner(owner_id,title)")
      .eq("id", id)
      .eq("generated_artifacts.owner_id", ownerId)
      .maybeSingle();
    if (version.error) throw version.error;
    if (!version.data?.storage_key)
      return apiResponse({ code: "RENDERED_ARTIFACT_UNAVAILABLE" }, request, 404);
    const object = await client.storage.from("private-artifact").download(version.data.storage_key);
    if (object.error || !object.data)
      return apiResponse({ code: "RENDERED_ARTIFACT_UNAVAILABLE" }, request, 404);
    const generated = version.data.generated_artifacts as unknown;
    const titleValue = Array.isArray(generated)
      ? (generated[0] as { title?: unknown } | undefined)?.title
      : (generated as { title?: unknown } | null)?.title;
    const title =
      typeof titleValue === "string" ? titleValue.replace(/[^a-z0-9._-]+/gi, "-") : "artifact";
    return new Response(await object.data.arrayBuffer(), {
      headers: {
        "content-type": version.data.media_type ?? "application/pdf",
        "content-disposition": `attachment; filename="${title}.pdf"`,
        "cache-control": "private, no-store"
      }
    });
  });
}
