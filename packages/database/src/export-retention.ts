import { createHash } from "node:crypto";

export interface ExportManifest {
  id: string;
  ownerId: string;
  createdAt: string;
  resourceCounts: Record<string, number>;
  checksum: string;
}

export function createExportManifest(
  ownerId: string,
  resourceCounts: Record<string, number>
): ExportManifest {
  const createdAt = new Date().toISOString();
  const payload = JSON.stringify({ ownerId, resourceCounts, createdAt });
  return {
    id: crypto.randomUUID(),
    ownerId,
    createdAt,
    resourceCounts,
    checksum: createHash("sha256").update(payload).digest("hex")
  };
}

export function retentionDeadline(createdAt: string, days = 30): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.valueOf()) || days < 1) throw new Error("INVALID_RETENTION_WINDOW");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}
