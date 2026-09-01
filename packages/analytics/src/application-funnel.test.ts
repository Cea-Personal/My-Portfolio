import { expect, it } from "vitest";
import { applicationFunnel } from "./application-funnel";

it("returns stable funnel counts", () => {
  expect(applicationFunnel(["draft", "submitted", "submitted"]).submitted).toBe(2);
});
