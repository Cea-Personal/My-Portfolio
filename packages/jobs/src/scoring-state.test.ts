import { expect, it } from "vitest";
import { calculateOpportunityScore } from "./opportunity-score";
import { transitionJob } from "./job-state";

it("calculates reproducible opportunity scores and valid transitions", () => {
  expect(
    calculateOpportunityScore({ alignment: 1, growth: 1, compensation: 1, logistics: 1 }).score
  ).toBe("1.0000");
  expect(transitionJob("discovered", "shortlisted")).toBe("shortlisted");
});
