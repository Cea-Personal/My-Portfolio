import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const { data, error } = await client
      .schema("app")
      .from("application_packages")
      .select("*")
      .eq("application_id", id)
      .in("application_id", [id])
      .order("version", { ascending: false });
    if (error) throw error;
    const owned = data ?? [];
    if (owned.length) {
      const { data: application } = await client
        .schema("app")
        .from("applications")
        .select("id")
        .eq("id", id)
        .eq("owner_id", ownerId)
        .maybeSingle();
      if (!application) return apiResponse([], request);
    }
    return apiResponse(owned, request);
  });
}
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
      .from("application_packages")
      .insert({
        application_id: applicationId,
        version: Number.isInteger(body.version) ? body.version : 1,
        status: "draft",
        manifest_hash:
          typeof body.manifestHash === "string" ? body.manifestHash : crypto.randomUUID()
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("PACKAGE_CREATE_FAILED");
    return apiResponse(data, request, 201);
  });
}
