import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("automation_schedules")
      .select("*")
      .eq("owner_id", ownerId);
    if (error) throw error;
    return apiResponse(data ?? [], request);
  });
}
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    if (typeof body.purpose !== "string" || typeof body.recurrence !== "string")
      return apiResponse({ code: "INVALID_AUTOMATION" }, request, 400);
    const { data, error } = await client
      .schema("app")
      .from("automation_schedules")
      .insert({
        owner_id: ownerId,
        purpose: body.purpose.slice(0, 120),
        recurrence: body.recurrence.slice(0, 120),
        timezone: typeof body.timezone === "string" ? body.timezone : "Africa/Kigali",
        enabled: false
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("AUTOMATION_CREATE_FAILED");
    return apiResponse(data, request, 201);
  });
}
