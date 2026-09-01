import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const { data, error } = await client
      .schema("app")
      .from("applications")
      .select("*, application_status_history(*)")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) throw error;
    return apiResponse(data, request, data ? 200 : 404);
  });
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { data: current, error: currentError } = await client
      .schema("app")
      .from("applications")
      .select("revision, status")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) return apiResponse(null, request, 404);
    if (Number.isInteger(body.revision) && body.revision !== current.revision)
      return apiResponse(
        { code: "REVISION_CONFLICT", detail: "The application changed since it was loaded" },
        request,
        409
      );
    const nextStatus = typeof body.status === "string" ? body.status : current.status;
    const { data, error } = await client
      .schema("app")
      .from("applications")
      .update({
        status: nextStatus,
        notes: typeof body.notes === "string" ? body.notes.slice(0, 10000) : undefined
      })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .eq("revision", current.revision)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return apiResponse(data, request, data ? 200 : 409);
  });
}
