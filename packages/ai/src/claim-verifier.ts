import type { Visibility } from "@career-os/contracts";
export interface Claim {
  statement: string;
  evidenceHandles: readonly string[];
  visibility: Visibility;
}
export function verifyPublicClaim(
  claim: Claim,
  knownHandles: ReadonlySet<string>
): { verified: boolean; reason?: string } {
  if (claim.visibility !== "public") return { verified: false, reason: "PRIVATE_CLAIM" };
  if (!claim.statement.trim()) return { verified: false, reason: "EMPTY_CLAIM" };
  if (
    !claim.evidenceHandles.length ||
    claim.evidenceHandles.some((handle) => !knownHandles.has(handle))
  )
    return { verified: false, reason: "MISSING_EVIDENCE" };
  return { verified: true };
}
