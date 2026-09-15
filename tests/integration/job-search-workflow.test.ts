import { expect, it } from "vitest";
import { jobgetherAdapter } from "@career-os/jobs";

it("exposes the retained paginated job source adapter", () => {
  expect(jobgetherAdapter.type).toBe("jobgether");
  expect(jobgetherAdapter.capabilities).toContain("pagination");
});
