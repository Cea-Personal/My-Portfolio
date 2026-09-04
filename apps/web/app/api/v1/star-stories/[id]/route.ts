import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const fields = ["title", "situation", "task", "action", "result"] as const;
    if (fields.some((field) => typeof body[field] !== "string" || !body[field].trim()))
      return apiResponse({ code: "INVALID_STAR_STORY" }, request, 400);
    const evidenceIds = Array.isArray(body.evidenceIds)
      ? body.evidenceIds.filter((value: unknown): value is string => typeof value === "string")
      : [];
    if (!evidenceIds.length) return apiResponse({ code: "EVIDENCE_REQUIRED" }, request, 400);
    const evidence = await client
      .schema("app")
      .from("career_facts")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("verified_by_owner", true)
      .in("review_status", ["approved", "edited_approved"])
      .in("id", evidenceIds);
    if (evidence.error) throw evidence.error;
    if ((evidence.data ?? []).length !== evidenceIds.length)
      return apiResponse({ code: "UNVERIFIED_STORY_EVIDENCE" }, request, 409);
    const { data, error } = await client
      .schema("app")
      .from("star_stories")
      .update({
        ...Object.fromEntries(fields.map((field) => [field, body[field].trim().slice(0, 10_000)])),
        evidence_ids: evidenceIds,
        metrics: Array.isArray(body.metrics) ? body.metrics.slice(0, 30) : [],
        skills: Array.isArray(body.skills) ? body.skills.slice(0, 50) : [],
        technologies: Array.isArray(body.technologies) ? body.technologies.slice(0, 50) : [],
        project_id: typeof body.projectId === "string" && body.projectId ? body.projectId : null,
        role_id: typeof body.roleId === "string" && body.roleId ? body.roleId : null,
        visibility: body.visibility === "public" ? "public" : "private",
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return apiResponse(null, request, 404);
    return apiResponse(data, request);
  });
}
