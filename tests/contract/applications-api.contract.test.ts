import { expect, it } from "vitest";
import { snapshotSubmitted } from "@career-os/applications";
it("requires final owner-confirmed artifacts for submitted snapshots", () => {
  expect(() =>
    snapshotSubmitted(
      {
        id: "v",
        artifactId: "a",
        version: 1,
        status: "draft",
        binaryHash: "h",
        createdAt: new Date().toISOString()
      },
      true
    )
  ).toThrow();
});
