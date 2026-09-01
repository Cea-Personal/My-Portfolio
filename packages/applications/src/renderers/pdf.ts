import { createHash } from "node:crypto";
export function renderPdf(
  content: string,
  template: string
): { bytes: Uint8Array; hash: string; rendererVersion: string } {
  const bytes = new TextEncoder().encode(`%PDF-FAKE\n${template}\n${content}`);
  return {
    bytes,
    hash: createHash("sha256").update(bytes).digest("hex"),
    rendererVersion: "pdf-renderer.v1"
  };
}
