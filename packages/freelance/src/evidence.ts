export type FreelanceEvidenceSupport =
  | "direct"
  | "transferable"
  | "related"
  | "weak"
  | "contradictory"
  | "missing";

export interface FreelanceEvidenceMatch {
  requirement: string;
  support: FreelanceEvidenceSupport;
  evidenceIds: readonly string[];
  rationale: string;
  approvedForProposal: boolean;
}

export function unsupportedMaterialClaims(
  claims: readonly { text: string; evidenceIds: readonly string[]; ownerEdited?: boolean }[]
): readonly string[] {
  return claims
    .filter((claim) => !claim.ownerEdited && claim.evidenceIds.length === 0)
    .map((claim) => claim.text);
}
