import { describe, expect, it } from "vitest";
import { matchRequirements } from "./requirement-matcher";

const requirement = {
  id: "req-1",
  text: "Must build Python data pipelines",
  priority: "required" as const,
  category: "skill" as const,
  sequence: 0
};

describe("structured requirement matching", () => {
  it("distinguishes direct and transferable evidence with citations", () => {
    expect(
      matchRequirements([requirement], [
        {
          id: "evidence-1",
          content: "Built production Python data pipelines for analytics.",
          visibility: "public"
        }
      ])[0]
    ).toMatchObject({ outcome: "direct", match: 1, evidence: ["evidence-1"] });
    expect(
      matchRequirements([requirement], [
        { id: "evidence-2", content: "Designed reliable data platforms.", visibility: "public" }
      ])[0]
    ).toMatchObject({ outcome: "transferable", match: 0.55 });
  });

  it("distinguishes unsupported from an empty evidence corpus", () => {
    expect(
      matchRequirements([requirement], [
        { id: "evidence-3", content: "Designed accessible user interfaces.", visibility: "public" }
      ])[0]?.outcome
    ).toBe("unsupported");
    expect(matchRequirements([requirement], [])[0]?.outcome).toBe("insufficient_evidence");
  });
});
