import { createHash } from "node:crypto";
export function renderDocx(
  content: string,
  template: string
): { bytes: Uint8Array; hash: string; rendererVersion: string } {
  const bytes = new TextEncoder().encode(`DOCX-FAKE\n${template}\n${content}`);
  return {
    bytes,
    hash: createHash("sha256").update(bytes).digest("hex"),
    rendererVersion: "docx-renderer.v1"
  };
}
