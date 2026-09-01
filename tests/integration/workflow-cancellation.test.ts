import { expect, it } from "vitest";
import { isRetryable, isTerminal } from "@career-os/observability";

it("supports cooperative cancellation and bounded retries", () => {
  expect(isTerminal("cancelled")).toBe(true);
  expect(isRetryable("WORKER_LOST")).toBe(true);
});
