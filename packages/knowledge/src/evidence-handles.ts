import { createHash, randomBytes } from "node:crypto";

export interface EvidenceHandle {
  handle: string;
  chunkId: string;
  sourceVersionHash: string;
  start: number;
  end: number;
}
const handles = new Map<string, EvidenceHandle>();

export function issueEvidenceHandle(input: Omit<EvidenceHandle, "handle">): string {
  const handle = `eh_${randomBytes(18).toString("base64url")}`;
  handles.set(handle, { ...input, handle });
  return handle;
}
export function resolveEvidenceHandle(handle: string): EvidenceHandle | null {
  const value = handles.get(handle);
  return value ? { ...value } : null;
}
export function publicCitation(
  handle: string,
  title: string
): { handle: string; title: string; citationHash: string } | null {
  if (!handles.has(handle)) return null;
  return {
    handle,
    title: title.slice(0, 200),
    citationHash: createHash("sha256").update(handle).digest("hex")
  };
}
