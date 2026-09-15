import { expect, it } from "vitest";
import { jobgetherAdapter } from "@career-os/jobs";

it("exposes versioned, bounded source adapter capabilities", () => {
  expect(jobgetherAdapter.version).toBe("v1");
  expect(jobgetherAdapter.capabilities).toContain("pagination");
});
