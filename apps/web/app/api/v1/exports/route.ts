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
  return withPrivateApi(request, async ({ client }) => {
    const requestedKey = request.headers.get("idempotency-key") ?? `export:${crypto.randomUUID()}`;
    const { data: exportId, error } = await client
      .schema("app")
      .rpc("request_data_export", { requested_key: requestedKey });
    if (error || !exportId) throw error ?? new Error("EXPORT_CREATE_FAILED");
    return apiResponse(
      { export: { id: exportId, format: "json" }, status: "queued" },
      request,
      202
    );
  });
}
