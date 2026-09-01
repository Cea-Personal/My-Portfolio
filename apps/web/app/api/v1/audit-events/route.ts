import { withPrivateApi } from "@/lib/api/private";
import { apiResponse } from "@/lib/api/response";

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("audit_events")
      .select(
        "id, action, target_type, target_id, correlation_id, occurred_at, before_metadata, after_metadata, reason"
      )
      .eq("owner_id", ownerId)
      .order("occurred_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return apiResponse({ data: data ?? [], page: { nextCursor: null } }, request);
  });
}
