import { expect, it } from "vitest";
import { requireArticleEvidence } from "@career-os/career";

it("requires evidence when an article makes a first-person career claim", () => {
  expect(() => requireArticleEvidence("I led a platform migration", [])).toThrow(
    "CAREER_CLAIM_EVIDENCE_REQUIRED"
  );
  expect(() => requireArticleEvidence("I led a platform migration", ["e1"])).not.toThrow();
});
