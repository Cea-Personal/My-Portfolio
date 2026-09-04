import { describe, expect, it } from "vitest";
import { coordinateTask } from "./orchestrator";
describe("central task coordinator", () => {
  it("keeps deterministic work out of a reasoning provider", () => {
    expect(coordinateTask("job_search").execution).toBe("deterministic");
  });
  it("classifies bounded reasoning and rejects unknown work", () => {
    expect(coordinateTask("interview_preparation").execution).toBe("reasoning");
    expect(() => coordinateTask("browse_everything")).toThrow("COORDINATED_TASK_NOT_ALLOWED");
  });
});
