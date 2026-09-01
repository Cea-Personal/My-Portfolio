import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("posts")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return apiResponse({ posts: data ?? [] }, request);
  });
}
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    if (typeof body.slug !== "string" || !body.slug.trim())
      return apiResponse({ code: "INVALID_POST", detail: "slug is required" }, request, 400);
    const { data, error } = await client
      .schema("app")
      .from("posts")
      .insert({ owner_id: ownerId, slug: body.slug.trim().slice(0, 160), status: "draft" })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("POST_CREATE_FAILED");
    return apiResponse({ post: data }, request, 201);
  });
}
