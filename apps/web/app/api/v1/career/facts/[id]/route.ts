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
    const expectedRevision = Number(request.headers.get("if-match"));
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0)
      return apiResponse({ code: "INVALID_REVISION" }, request, 400);
    const allowed: Record<string, string | number | boolean> = {
      visibility:
        body.visibility === "public"
          ? "public"
          : body.visibility === "restricted"
            ? "restricted"
            : "private",
      revision: expectedRevision + 1
    };
    if (
      ["candidate", "in_review", "approved", "edited_approved", "rejected", "deferred"].includes(
        body.reviewStatus
      )
    )
      allowed.review_status = body.reviewStatus;
    if (typeof body.verifiedByOwner === "boolean") allowed.verified_by_owner = body.verifiedByOwner;
    const { data, error } = await client
      .schema("app")
      .from("career_facts")
      .update(allowed)
      .eq("id", id)
      .eq("owner_id", ownerId)
      .eq("revision", expectedRevision)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return apiResponse(
      data ?? { code: "REVISION_CONFLICT", detail: "The fact changed; reload and try again." },
      request,
      data ? 200 : 409
    );
  });
}
