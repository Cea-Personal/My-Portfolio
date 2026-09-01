import { expect, it } from "vitest";
import { createPreparationKit } from "./preparation-kit";

it("creates a versioned kit with confidence-tagged questions", () => {
  const kit = createPreparationKit("stage-1", [
    { question: "How?", confidence: "high", evidenceIds: ["e1"] }
  ]);
  expect(kit.schemaVersion).toBe("interview-kit.v1");
  expect(kit.questions[0]?.evidenceIds).toEqual(["e1"]);
});
