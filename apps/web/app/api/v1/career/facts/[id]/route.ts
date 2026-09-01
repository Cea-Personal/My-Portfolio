import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const { data, error } = await client
      .schema("app")
      .from("career_facts")
      .select("*, career_fact_versions(*)")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) throw error;
    return apiResponse(data, request, data ? 200 : 404);
  });
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const allowed = {
      visibility:
        body.visibility === "public"
          ? "public"
          : body.visibility === "restricted"
            ? "restricted"
            : "private",
      review_status: [
        "candidate",
        "in_review",
        "approved",
        "edited_approved",
        "rejected",
        "deferred"
      ].includes(body.reviewStatus)
        ? body.reviewStatus
        : undefined,
      verified_by_owner: body.verifiedByOwner === true
    };
    const { data, error } = await client
      .schema("app")
      .from("career_facts")
      .update(allowed)
      .eq("id", id)
      .eq("owner_id", ownerId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return apiResponse(data, request, data ? 200 : 404);
  });
}
