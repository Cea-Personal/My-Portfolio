import { expect, it } from "vitest";
import { recommendCompensation } from "./recommendation";
it("returns dated-tiered decimal values", () => {
  expect(
    recommendCompensation({ benchmark: "100", currency: "USD", period: "annual" }).target
  ).toBe("110.00");
});
