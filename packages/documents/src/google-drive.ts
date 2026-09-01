import { createHash } from "node:crypto";

export interface DriveChange {
  fileId: string;
  name: string;
  mimeType: string;
  version: string;
  removed?: boolean;
  modifiedTime?: string;
  md5Checksum?: string;
  permissionLost?: boolean;
}
export interface DrivePage {
  changes: readonly DriveChange[];
  nextPageToken?: string;
  newStartPageToken?: string;
}
export interface DriveClient {
  listChanges(pageToken: string, pageSize: number): Promise<DrivePage>;
  exportFile(fileId: string, mimeType: string): Promise<Uint8Array>;
}

export async function drainDriveChanges(
  client: DriveClient,
  startToken: string,
  options: { pageSize?: number; maxPages?: number } = {}
): Promise<{ changes: DriveChange[]; nextToken: string; pages: number }> {
  let token = startToken;
  const changes: DriveChange[] = [];
  const pageSize = Math.min(options.pageSize ?? 100, 1000);
  const maxPages = Math.min(options.maxPages ?? 100, 1000);
  for (let page = 0; page < maxPages; page += 1) {
    const result = await client.listChanges(token, pageSize);
    changes.push(...result.changes);
    if (!result.nextPageToken)
      return { changes, nextToken: result.newStartPageToken ?? token, pages: page + 1 };
    token = result.nextPageToken;
  }
  throw new Error("Drive change drain exceeded page limit");
}

export function contentHash(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

export function unchangedContent(previousHash: string | undefined, content: Uint8Array): boolean {
  return previousHash === contentHash(content);
}

export interface DriveDocumentState {
  fileId: string;
  version: string;
  contentHash: string;
  availability: "available" | "partial" | "unavailable";
  removedAt?: string;
  permissionLostAt?: string;
}

export interface DriveReconciliation {
  unchanged: string[];
  changed: DriveChange[];
  removed: string[];
  permissionLost: string[];
  nextToken: string;
}

/**
 * Applies a drained change page without mutating prior versions. A caller can
 * persist the returned decisions as document/evidence versions and tombstones.
 */
export function reconcileDriveChanges(
  previous: readonly DriveDocumentState[],
  changes: readonly DriveChange[],
  nextToken: string,
  now = new Date().toISOString()
): DriveReconciliation {
  const byId = new Map(previous.map((item) => [item.fileId, item]));
  const unchanged: string[] = [];
  const changed: DriveChange[] = [];
  const removed: string[] = [];
  const permissionLost: string[] = [];
  for (const change of changes) {
    const current = byId.get(change.fileId);
    if (change.removed) {
      removed.push(change.fileId);
      if (current)
        byId.set(change.fileId, { ...current, availability: "unavailable", removedAt: now });
      continue;
    }
    if (change.permissionLost) {
      permissionLost.push(change.fileId);
      if (current)
        byId.set(change.fileId, { ...current, availability: "unavailable", permissionLostAt: now });
      continue;
    }
    if (
      current &&
      current.version === change.version &&
      current.contentHash === (change.md5Checksum ?? "")
    ) {
      unchanged.push(change.fileId);
      continue;
    }
    changed.push(change);
  }
  return { unchanged, changed, removed, permissionLost, nextToken };
}
