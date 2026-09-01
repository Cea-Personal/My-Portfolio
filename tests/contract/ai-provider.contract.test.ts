import { expect, it } from "vitest";
import { PrimaryProvider } from "@career-os/ai";
it("returns versioned structured provider output", async () => {
  const result = await new PrimaryProvider().generate({
    model: "fake",
    promptHash: "hash",
    input: { ok: true },
    outputSchemaVersion: "v1"
  });
  expect(result.schemaVersion).toBe("v1");
});
