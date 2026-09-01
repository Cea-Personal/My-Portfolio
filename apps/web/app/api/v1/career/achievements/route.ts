import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("achievements")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return apiResponse(data ?? [], request);
  });
}
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    if (typeof body.statement !== "string")
      return apiResponse({ code: "INVALID_ACHIEVEMENT" }, request, 400);
    const { data, error } = await client
      .schema("app")
      .from("achievements")
      .insert({
        owner_id: ownerId,
        statement: body.statement.slice(0, 10000),
        action: typeof body.action === "string" ? body.action.slice(0, 2000) : null,
        outcome: typeof body.outcome === "string" ? body.outcome.slice(0, 5000) : null,
        visibility: "private"
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("ACHIEVEMENT_CREATE_FAILED");
    return apiResponse(data, request, 201);
  });
}
