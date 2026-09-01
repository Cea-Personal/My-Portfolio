import { expect, it } from "vitest";
import { inferInterviewProcess, reorderStages } from "./index";
it("keeps unknown interview processes explicitly unknown", () => {
  expect(inferInterviewProcess([]).stages[0]?.source).toBe("unknown");
});
it("reorders arbitrary owner-defined stages", () => {
  const stages = inferInterviewProcess(["Recruiter", "Technical"]).stages;
  expect(reorderStages(stages, [stages[1]!.id, stages[0]!.id])[0]?.name).toBe("Technical");
});
