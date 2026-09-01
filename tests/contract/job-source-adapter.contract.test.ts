import { expect, it } from "vitest";
import { greenhouseAdapter } from "@career-os/jobs";

it("exposes versioned, bounded source adapter capabilities", () => {
  expect(greenhouseAdapter.version).toBe("v1");
  expect(greenhouseAdapter.capabilities).toContain("pagination");
});
