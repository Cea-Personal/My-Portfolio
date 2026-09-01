import { createHash, randomUUID } from "node:crypto";
import type { TrustLevel, Visibility } from "@career-os/contracts";

export type SupportClass = "direct" | "transferable" | "related" | "weak" | "contradictory";
export interface EvidenceChunk {
  id: string;
  evidenceVersionId: string;
  ordinal: number;
  content: string;
  contentHash: string;
  charStart: number;
  charEnd: number;
  visibility: Visibility;
  trustLevel: TrustLevel;
  deletedAt?: string;
}
export interface ClaimEvidence {
  id: string;
  factVersionId: string;
  chunkId: string;
  start: number;
  end: number;
  supportClass: SupportClass;
  verified: boolean;
  rationale?: string;
}

export function createEvidenceChunk(
  input: Omit<EvidenceChunk, "id" | "contentHash">
): EvidenceChunk {
  if (
    input.charStart < 0 ||
    input.charEnd <= input.charStart ||
    input.charEnd - input.charStart !== input.content.length
  )
    throw new Error("Evidence offsets must exactly cover normalized content");
  return {
    ...input,
    id: randomUUID(),
    contentHash: createHash("sha256").update(input.content).digest("hex")
  };
}

export function linkClaimEvidence(input: Omit<ClaimEvidence, "id">): ClaimEvidence {
  if (input.end <= input.start || input.start < 0) throw new Error("Claim offsets are invalid");
  if (input.supportClass === "contradictory" && input.verified)
    throw new Error("Contradictory evidence cannot be verified support");
  return { ...input, id: randomUUID() };
}

export function hasPublishableEvidence(links: readonly ClaimEvidence[]): boolean {
  return links.some(
    (link) => link.verified && ["direct", "transferable"].includes(link.supportClass)
  );
}
