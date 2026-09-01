import { expect, it } from "vitest";
import { redactTelemetry } from "@career-os/observability";

it("redacts canaries and private fixture content from telemetry payloads", () => {
  const safe = redactTelemetry({ message: "CANARY_SECRET", ownerId: "private-owner", ok: true });
  expect(JSON.stringify(safe)).not.toContain("CANARY_SECRET");
  expect(safe.ok).toBe(true);
});
