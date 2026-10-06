import { transitionFreelanceApprovalState } from "@career-os/freelance";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const proposal = await client.schema("app").from("freelance_proposals").select("*, freelance_proposal_versions(*)").eq("id", id).eq("owner_id", ownerId).maybeSingle();
    if (proposal.error) throw proposal.error;
    if (!proposal.data) return apiResponse(null, request, 404);
    const currentVersion = (proposal.data.freelance_proposal_versions ?? []).find((version: { id: string }) => version.id === proposal.data.current_version_id);
    if (
      proposal.data.approval_state !== "READY_FOR_REVIEW" ||
      proposal.data.crm_status !== "READY_FOR_REVIEW" ||
      !currentVersion ||
      currentVersion.source !== "owner_edited" ||
      !currentVersion.reviewed_at
    ) return apiResponse({ code: "OWNER_REVIEW_REQUIRED", detail: "Edit the current proposal and mark that version ready for review first." }, request, 409);
    const unsupported = Array.isArray(currentVersion.unsupported_claims) && currentVersion.unsupported_claims.length > 0;
    const claims = Array.isArray(currentVersion.claim_refs) ? currentVersion.claim_refs as Array<{ evidenceIds?: unknown }> : [];
    const unreferencedClaims = claims.length === 0 || claims.some((claim) => !Array.isArray(claim.evidenceIds) || claim.evidenceIds.length === 0);
    try {
      transitionFreelanceApprovalState(proposal.data.approval_state, "APPROVED", { hasUnsupportedMaterialClaims: unsupported || unreferencedClaims, explicitOwnerApproval: true });
    } catch (error) {
      return apiResponse({ code: error instanceof Error ? error.message : "PROPOSAL_APPROVAL_FAILED" }, request, 409);
    }
    const approvedAt = new Date().toISOString();
    const result = await client.schema("app").from("freelance_proposals").update({ approval_state: "APPROVED", approved_at: approvedAt, revision: Number(proposal.data.revision ?? 0) + 1 }).eq("id", id).eq("owner_id", ownerId).select("*").single();
    if (result.error || !result.data) throw result.error ?? new Error("PROPOSAL_APPROVAL_FAILED");
    const versionUpdate = await client.schema("app").from("freelance_proposal_versions").update({ approved_at: approvedAt }).eq("id", currentVersion.id).eq("owner_id", ownerId);
    if (versionUpdate.error) throw versionUpdate.error;
    const history = await client.schema("app").from("freelance_proposal_status_history").insert({ owner_id: ownerId, proposal_id: id, from_status: proposal.data.crm_status, to_status: result.data.crm_status, from_approval_state: proposal.data.approval_state, to_approval_state: "APPROVED", actor_id: ownerId, reason: "owner_approved_proposal" });
    if (history.error) throw history.error;
    return apiResponse({ proposal: result.data }, request);
  });
}
