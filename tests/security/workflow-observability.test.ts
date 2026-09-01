import { expect, it } from "vitest";
import { assertAutomationActionAllowed } from "@career-os/auth";
it("denies consequential automation actions", () => {
  expect(() => assertAutomationActionAllowed("submit")).toThrow();
});
