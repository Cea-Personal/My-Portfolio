import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("export_requests")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return apiResponse({ exports: data ?? [] }, request);
  });
}
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    const { data, error } = await client
      .schema("app")
      .from("export_requests")
      .insert({
        owner_id: ownerId,
        format: body.format === "zip" ? "zip" : "json",
        status: "queued"
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("EXPORT_CREATE_FAILED");
    return apiResponse({ export: data, status: data.status }, request, 202);
  });
}
