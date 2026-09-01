import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("job_sources")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return apiResponse({ sources: data ?? [] }, request);
  });
}
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    if (typeof body.name !== "string" || typeof body.adapterType !== "string")
      return apiResponse({ code: "INVALID_SOURCE" }, request, 400);
    const { data, error } = await client
      .schema("app")
      .from("job_sources")
      .insert({
        owner_id: ownerId,
        name: body.name.slice(0, 160),
        adapter_type: body.adapterType.slice(0, 80),
        adapter_version: typeof body.adapterVersion === "string" ? body.adapterVersion : "v1",
        enabled: false
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("SOURCE_CREATE_FAILED");
    return apiResponse({ source: data }, request, 201);
  });
}
