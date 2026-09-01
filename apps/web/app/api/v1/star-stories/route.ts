import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("star_stories")
      .select("*")
      .eq("owner_id", ownerId);
    if (error) throw error;
    return apiResponse(data ?? [], request);
  });
}
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    const fields = ["title", "situation", "task", "action", "result"] as const;
    if (fields.some((field) => typeof body[field] !== "string" || !body[field].trim()))
      return apiResponse({ code: "INVALID_STAR_STORY" }, request, 400);
    const { data, error } = await client
      .schema("app")
      .from("star_stories")
      .insert({
        owner_id: ownerId,
        ...Object.fromEntries(fields.map((field) => [field, body[field].trim().slice(0, 10_000)])),
        evidence_ids: Array.isArray(body.evidenceIds) ? body.evidenceIds : []
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("STAR_STORY_CREATE_FAILED");
    return apiResponse(data, request, 201);
  });
}
