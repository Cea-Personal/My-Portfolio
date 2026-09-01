import { expect, it } from "vitest";
import { isRetryable } from "@career-os/observability";
it("classifies transient provider failures for retry", () => {
  expect(isRetryable("PROVIDER_429")).toBe(true);
  expect(isRetryable("INVALID_SCHEMA")).toBe(false);
});
