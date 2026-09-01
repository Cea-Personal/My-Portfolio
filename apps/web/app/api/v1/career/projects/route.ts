import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("projects")
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
    if (typeof body.title !== "string" || typeof body.slug !== "string")
      return apiResponse({ code: "INVALID_PROJECT" }, request, 400);
    const { data, error } = await client
      .schema("app")
      .from("projects")
      .insert({
        owner_id: ownerId,
        project_type:
          body.projectType === "open_source" || body.projectType === "professional"
            ? body.projectType
            : "personal",
        title: body.title.slice(0, 240),
        slug: body.slug.slice(0, 160),
        private_description:
          typeof body.description === "string" ? body.description.slice(0, 20000) : null,
        visibility: "private"
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("PROJECT_CREATE_FAILED");
    return apiResponse(data, request, 201);
  });
}
