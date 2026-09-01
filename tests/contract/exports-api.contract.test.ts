import { expect, it } from "vitest";
import { createExportManifest, retentionDeadline } from "@career-os/database";

it("creates checksummed export manifests with bounded retention", () => {
  const manifest = createExportManifest("owner-1", { facts: 2 });
  expect(manifest.checksum).toHaveLength(64);
  expect(new Date(retentionDeadline(manifest.createdAt)).getTime()).toBeGreaterThan(
    new Date(manifest.createdAt).getTime()
  );
});
