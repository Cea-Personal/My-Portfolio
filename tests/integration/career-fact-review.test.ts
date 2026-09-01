import { describe, expect, it } from "vitest";
import { createManualFact, correctFact } from "@career-os/career";
import { reviewFact, setVisibility } from "@career-os/career";

describe("career fact review", () => {
  it("keeps corrections as immutable versions", () => {
    const fact = createManualFact({
      ownerId: "00000000-0000-4000-8000-000000000001",
      factType: "achievement",
      subjectType: "project",
      subjectId: "00000000-0000-4000-8000-000000000002",
      statement: "Reduced latency",
      editorActor: "owner"
    });
    const corrected = correctFact(fact, {
      statement: "Reduced latency by 40%",
      editorActor: "owner",
      reason: "Added measured result"
    });
    expect(corrected.versions).toHaveLength(2);
    expect(fact.versions).toHaveLength(1);
    expect(setVisibility(reviewFact(corrected, "approve", "owner"), "public").visibility).toBe(
      "public"
    );
  });
});
