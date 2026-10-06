import {
  FREELANCE_APPROVAL_TRANSITIONS,
  FREELANCE_CRM_TRANSITIONS,
  type FreelanceApprovalState,
  type FreelanceCrmStatus
} from "./types";

export function transitionFreelanceCrmStatus(
  from: FreelanceCrmStatus,
  to: FreelanceCrmStatus
): FreelanceCrmStatus {
  if (!FREELANCE_CRM_TRANSITIONS[from].includes(to)) throw new Error("INVALID_FREELANCE_CRM_TRANSITION");
  return to;
}

export function transitionFreelanceApprovalState(
  from: FreelanceApprovalState,
  to: FreelanceApprovalState,
  input: { hasUnsupportedMaterialClaims?: boolean; explicitOwnerApproval?: boolean } = {}
): FreelanceApprovalState {
  if (!FREELANCE_APPROVAL_TRANSITIONS[from].includes(to))
    throw new Error("INVALID_FREELANCE_APPROVAL_TRANSITION");
  if (to === "APPROVED" && input.hasUnsupportedMaterialClaims)
    throw new Error("UNSUPPORTED_PROPOSAL_CLAIMS");
  if (to === "APPROVED" && !input.explicitOwnerApproval)
    throw new Error("OWNER_APPROVAL_REQUIRED");
  if (to === "SUBMITTED" && from !== "APPROVED") throw new Error("PROPOSAL_MUST_BE_APPROVED");
  if (to === "SUBMITTED" && !input.explicitOwnerApproval) throw new Error("OWNER_APPROVAL_REQUIRED");
  return to;
}
