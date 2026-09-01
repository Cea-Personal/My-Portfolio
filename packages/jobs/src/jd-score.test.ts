import { expect, it } from "vitest";
import { scoreRequirements } from "./jd-score";
it("uses deterministic decimal scoring", () => {
  expect(scoreRequirements([{ id: "r", priority: "required", match: 1, evidence: [] }]).score).toBe(
    "1.0000"
  );
});

it("clamps out-of-range matches before scoring", () => {
  expect(scoreRequirements([{ id: "r", priority: "required", match: 3, evidence: [] }]).score).toBe(
    "1.0000"
  );
});
