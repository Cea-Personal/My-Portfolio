import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    const { id } = await params;
    if (!["approve", "edit", "reject", "defer"].includes(body.decision))
      return apiResponse(
        { code: "INVALID_REVIEW", detail: "Unsupported review decision" },
        request,
        400
      );
    const reviewStatus =
      body.decision === "approve"
        ? "approved"
        : body.decision === "reject"
          ? "rejected"
          : body.decision === "edit"
            ? "edited_approved"
            : "deferred";
    const { data, error } = await client
      .schema("app")
      .from("career_facts")
      .update({
        review_status: reviewStatus,
        verified_by_owner: body.decision === "approve" || body.decision === "edit"
      })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return apiResponse(
      data ? { decision: body.decision, reviewStatus, fact: data } : null,
      request,
      data ? 200 : 404
    );
  });
}
