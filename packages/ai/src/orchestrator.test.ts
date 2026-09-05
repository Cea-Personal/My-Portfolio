import { describe, expect, it } from "vitest";
import { coordinateTask, subagentForTask, subagentRoles } from "./orchestrator";
describe("central task coordinator", () => {
  it("keeps deterministic work out of a reasoning provider", () => {
    expect(coordinateTask("job_search").execution).toBe("deterministic");
  });
  it("classifies bounded reasoning and rejects unknown work", () => {
    expect(coordinateTask("interview_preparation")).toMatchObject({
      execution: "reasoning",
      delegation: "subagent",
      orchestrator: "single_model",
      subagent: { label: "Interview coach" }
    });
    expect(() => coordinateTask("browse_everything")).toThrow("COORDINATED_TASK_NOT_ALLOWED");
  });
  it("registers every reasoning task as a subagent role", () => {
    expect(subagentRoles).toHaveLength(9);
    expect(subagentForTask("role_fit")?.label).toBe("Role-fit analyst");
    expect(subagentForTask("unknown")).toBeNull();
  });
});
