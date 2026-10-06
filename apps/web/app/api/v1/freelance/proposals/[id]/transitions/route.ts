import { transitionFreelanceCrmStatus, type FreelanceCrmStatus } from "@career-os/freelance";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const parsed = await request.json().catch(() => ({}));
    const body = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
    const next = typeof body.crmStatus === "string" ? body.crmStatus as FreelanceCrmStatus : null;
    if (!next || ["SUBMITTED", "READY_FOR_REVIEW", "PROPOSAL_DRAFTED"].includes(next))
      return apiResponse({ code: "INVALID_FREELANCE_TRANSITION", detail: "Use the review or manual submission action for proposal preparation and submission states." }, request, 400);
    const query = await client.schema("app").from("freelance_proposals").select("*").eq("id", id).eq("owner_id", ownerId).maybeSingle();
    if (query.error) throw query.error;
    if (!query.data) return apiResponse(null, request, 404);
    try {
      transitionFreelanceCrmStatus(query.data.crm_status as FreelanceCrmStatus, next);
    } catch {
      return apiResponse({ code: "INVALID_FREELANCE_TRANSITION", detail: `${query.data.crm_status} cannot transition to ${next}` }, request, 409);
    }
    if (["VIEWED", "CLIENT_RESPONDED", "INTERVIEW", "NEGOTIATION", "WON", "LOST", "WITHDRAWN"].includes(next) && query.data.approval_state !== "SUBMITTED")
      return apiResponse({ code: "PROPOSAL_NOT_SUBMITTED" }, request, 409);
    const result = await client.schema("app").from("freelance_proposals").update({ crm_status: next, revision: Number(query.data.revision ?? 0) + 1, ...(["WON", "LOST", "WITHDRAWN"].includes(next) ? { closed_at: new Date().toISOString() } : {}) }).eq("id", id).eq("owner_id", ownerId).eq("crm_status", query.data.crm_status).select("*").maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return apiResponse({ code: "PROPOSAL_CHANGED_RELOAD" }, request, 409);
    const history = await client.schema("app").from("freelance_proposal_status_history").insert({ owner_id: ownerId, proposal_id: id, from_status: query.data.crm_status, to_status: next, from_approval_state: query.data.approval_state, to_approval_state: query.data.approval_state, actor_id: ownerId, reason: typeof body.reason === "string" ? body.reason.slice(0, 1000) : "owner_pipeline_update" });
    if (history.error) throw history.error;
    return apiResponse({ proposal: result.data }, request);
  });
}
