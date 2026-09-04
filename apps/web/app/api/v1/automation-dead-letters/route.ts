import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("automation_dead_letters")
      .select(
        "id,run_id,event_id,event_name,payload_metadata,reason,created_at,resolved_at,resolution_note"
      )
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return apiResponse({ deadLetters: data ?? [] }, request);
  });
}
