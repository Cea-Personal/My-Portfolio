import type { ReviewStatus, TrustLevel, Visibility } from "@career-os/contracts";
import type { CareerFact } from "./facts";
import { correctFact } from "./facts";

export type ReviewDecision = "approve" | "edit_and_approve" | "reject" | "defer";

export function reviewFact(
  fact: CareerFact,
  decision: ReviewDecision,
  reviewer: string,
  edit?: { statement: string; structuredValue?: Record<string, unknown>; reason: string }
): CareerFact {
  if (!reviewer) throw new Error("Reviewer is required");
  if (decision === "edit_and_approve") {
    if (!edit) throw new Error("Edited content is required");
    return correctFact(fact, { ...edit, editorActor: reviewer });
  }
  const terminal: Record<
    Exclude<ReviewDecision, "edit_and_approve">,
    { reviewStatus: ReviewStatus; trustLevel: TrustLevel; verifiedByOwner: boolean }
  > = {
    approve: {
      reviewStatus: "approved",
      trustLevel: "ai_extracted_reviewed",
      verifiedByOwner: true
    },
    reject: { reviewStatus: "rejected", trustLevel: fact.trustLevel, verifiedByOwner: false },
    defer: { reviewStatus: "deferred", trustLevel: fact.trustLevel, verifiedByOwner: false }
  };
  return { ...fact, ...terminal[decision] };
}

export function setVisibility(fact: CareerFact, visibility: Visibility): CareerFact {
  if (
    visibility === "public" &&
    (!fact.verifiedByOwner || !["approved", "edited_approved"].includes(fact.reviewStatus))
  ) {
    throw new Error("Only owner-reviewed facts may become public");
  }
  return { ...fact, visibility };
}
