import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data: runs, error: runError } = await client
      .schema("app")
      .from("ingestion_runs")
      .select("id")
      .eq("owner_id", ownerId);
    if (runError) throw runError;
    const runIds = (runs ?? []).map((run) => run.id).filter(Boolean);
    if (!runIds.length) return apiResponse([], request);
    const { data: items, error: itemError } = await client
      .schema("app")
      .from("ingestion_items")
      .select("id")
      .in("run_id", runIds);
    if (itemError) throw itemError;
    const itemIds = (items ?? []).map((item) => item.id).filter(Boolean);
    if (!itemIds.length) return apiResponse([], request);
    const { data, error } = await client
      .schema("app")
      .from("extracted_facts")
      .select("*")
      .in("ingestion_item_id", itemIds)
      .eq("review_status", "candidate");
    if (error) throw error;
    return apiResponse(data ?? [], request);
  });
}
