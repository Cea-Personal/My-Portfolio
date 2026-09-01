import { describe, expect, it } from "vitest";
import { consumeConfirmationToken, issueConfirmationToken } from "@career-os/auth";
import { moneySchema, workflowEventSchema } from "@career-os/contracts";
import { normalizeIdempotencyKey } from "@career-os/database";
import { redactTelemetry } from "@career-os/observability";

describe("foundation boundaries", () => {
  it("accepts decimal money and rejects floating point values", () => {
    expect(moneySchema.parse({ amount: "100.25", currency: "USD" }).amount).toBe("100.25");
    expect(() => moneySchema.parse({ amount: 100.25, currency: "USD" })).toThrow();
  });

  it("rejects event payloads without the versioned envelope", () => {
    expect(() =>
      workflowEventSchema.parse({ name: "career/job.v1", id: "x", ts: 1, data: {} })
    ).toThrow();
  });

  it("allows a confirmation token only once and for its intended action", () => {
    const token = issueConfirmationToken("owner", "publish", "publication");
    expect(consumeConfirmationToken(token, "owner", "publish", "publication")).toBe(true);
    expect(consumeConfirmationToken(token, "owner", "publish", "publication")).toBe(false);
  });

  it("normalizes only bounded idempotency keys", () => {
    expect(normalizeIdempotencyKey("request:2026-08-31")).toBe("request:2026-08-31");
    expect(() => normalizeIdempotencyKey("short")).toThrow();
  });

  it("redacts sensitive telemetry recursively", () => {
    expect(
      redactTelemetry({ prompt: "secret", nested: { answer: "private", status: "ok" } })
    ).toEqual({ prompt: "[REDACTED]", nested: { answer: "[REDACTED]", status: "ok" } });
  });
});
