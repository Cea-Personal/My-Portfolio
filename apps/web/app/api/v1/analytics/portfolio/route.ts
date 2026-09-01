import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("analytics_events")
      .select("event_name, occurred_at, properties")
      .eq("owner_id", ownerId)
      .order("occurred_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    const counts = (data ?? []).reduce<Record<string, number>>(
      (result, event) => ({ ...result, [event.event_name]: (result[event.event_name] ?? 0) + 1 }),
      {}
    );
    return apiResponse({ lowData: (data ?? []).length < 10, metrics: counts }, request);
  });
}
