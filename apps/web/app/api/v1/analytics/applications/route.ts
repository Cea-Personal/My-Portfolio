import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("applications")
      .select("status, created_at, applied_at")
      .eq("owner_id", ownerId);
    if (error) throw error;
    const metrics = (data ?? []).reduce<Record<string, number>>(
      (result, item) => ({ ...result, [item.status]: (result[item.status] ?? 0) + 1 }),
      {}
    );
    return apiResponse({ metrics }, request);
  });
}
