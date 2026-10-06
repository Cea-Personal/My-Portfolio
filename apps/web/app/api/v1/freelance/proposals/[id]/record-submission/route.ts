import { transitionFreelanceApprovalState } from "@career-os/freelance";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const proposal = await client.schema("app").from("freelance_proposals").select("*").eq("id", id).eq("owner_id", ownerId).maybeSingle();
    if (proposal.error) throw proposal.error;
    if (!proposal.data) return apiResponse(null, request, 404);
    if (proposal.data.crm_status !== "READY_FOR_REVIEW" || proposal.data.approval_state !== "APPROVED")
      return apiResponse({ code: "APPROVAL_REQUIRED", detail: "Approve the current reviewed proposal before recording its external submission." }, request, 409);
    try {
      transitionFreelanceApprovalState(proposal.data.approval_state, "SUBMITTED", { explicitOwnerApproval: true });
    } catch (error) {
      return apiResponse({ code: error instanceof Error ? error.message : "PROPOSAL_SUBMISSION_FAILED" }, request, 409);
    }
    const submittedAt = new Date().toISOString();
    const result = await client.schema("app").from("freelance_proposals").update({ approval_state: "SUBMITTED", crm_status: "SUBMITTED", submitted_at: submittedAt, revision: Number(proposal.data.revision ?? 0) + 1 }).eq("id", id).eq("owner_id", ownerId).select("*").single();
    if (result.error || !result.data) throw result.error ?? new Error("PROPOSAL_SUBMISSION_FAILED");
    const history = await client.schema("app").from("freelance_proposal_status_history").insert({ owner_id: ownerId, proposal_id: id, from_status: proposal.data.crm_status, to_status: "SUBMITTED", from_approval_state: proposal.data.approval_state, to_approval_state: "SUBMITTED", actor_id: ownerId, reason: "owner_recorded_external_submission" });
    if (history.error) throw history.error;
    return apiResponse({ proposal: result.data, externalSubmission: "manual_record_only", submittedAt }, request);
  });
}
