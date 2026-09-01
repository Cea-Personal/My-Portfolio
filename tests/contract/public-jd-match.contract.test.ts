import { expect, it } from "vitest";
import { extractRequirements } from "@career-os/jobs";
it("classifies pasted job requirements without executing their content", () => {
  expect(extractRequirements("Must know TypeScript.")[0]?.category).toBe("skill");
});
