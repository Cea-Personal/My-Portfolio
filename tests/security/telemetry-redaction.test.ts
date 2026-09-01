import { expect, it } from "vitest";
import { redactTelemetry } from "@career-os/observability";

it("never emits prompts, documents, signed URLs, or credentials", () => {
  const safe = redactTelemetry({
    prompt: "p",
    cv: "cv",
    signedUrl: "https://private",
    credential: "x",
    workflowStatus: "completed"
  });
  expect(JSON.stringify(safe)).not.toContain('"p"');
  expect(JSON.stringify(safe)).toContain("completed");
});
