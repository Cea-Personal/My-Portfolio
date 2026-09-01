import { createHash } from "node:crypto";

const allowed = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown"
]);
const maxBytes = 50 * 1024 * 1024;

export function validateUploadMetadata(input: {
  filename: string;
  mediaType: string;
  size: number;
}): void {
  if (!allowed.has(input.mediaType)) throw new Error("MEDIA_TYPE_NOT_ALLOWED");
  if (!Number.isSafeInteger(input.size) || input.size <= 0 || input.size > maxBytes)
    throw new Error("FILE_SIZE_NOT_ALLOWED");
  if (!input.filename || input.filename.length > 255 || input.filename.includes("/"))
    throw new Error("FILENAME_NOT_ALLOWED");
}

export function createPrivateObjectKey(
  ownerId: string,
  documentId: string,
  version: number
): string {
  if (!ownerId || !documentId || version < 1) throw new Error("Invalid object key input");
  return `${ownerId}/documents/${documentId}/v${version}`;
}

export function sha256(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}
