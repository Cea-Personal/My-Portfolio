import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const { data, error } = await client
      .schema("app")
      .from("job_sources")
      .select("*, job_source_configs(*)")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) throw error;
    return apiResponse(data ? { source: data } : null, request, data ? 200 : 404);
  });
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { data, error } = await client
      .schema("app")
      .from("job_sources")
      .update({
        enabled: body.enabled === true,
        terms_note: typeof body.termsNote === "string" ? body.termsNote.slice(0, 1000) : undefined
      })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return apiResponse(data, request, data ? 200 : 404);
  });
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const { data, error } = await client
      .schema("app")
      .from("job_sources")
      .update({ enabled: false })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return apiResponse({ removed: Boolean(data) }, request, data ? 200 : 404);
  });
}
