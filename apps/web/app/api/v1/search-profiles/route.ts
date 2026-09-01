import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("job_search_profiles")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return apiResponse({ profiles: data ?? [] }, request);
  });
}
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    if (typeof body.name !== "string")
      return apiResponse({ code: "INVALID_PROFILE" }, request, 400);
    const { data, error } = await client
      .schema("app")
      .from("job_search_profiles")
      .insert({
        owner_id: ownerId,
        name: body.name.slice(0, 160),
        target_titles: Array.isArray(body.targetTitles) ? body.targetTitles.slice(0, 50) : [],
        locations: Array.isArray(body.locations) ? body.locations.slice(0, 50) : [],
        enabled: false
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("PROFILE_CREATE_FAILED");
    return apiResponse({ profile: data }, request, 201);
  });
}
