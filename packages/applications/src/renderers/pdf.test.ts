import { describe, expect, it } from "vitest";
import { renderPdf } from "./pdf";

describe("PDF renderer", () => {
  it("emits a structurally complete PDF and a stable content hash", () => {
    const first = renderPdf("Basil Ogbonna\nData Engineer", "technical");
    const second = renderPdf("Basil Ogbonna\nData Engineer", "technical");
    const text = new TextDecoder().decode(first.bytes);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.endsWith("%%EOF\n")).toBe(true);
    expect(text).not.toContain("PDF-FAKE");
    expect(first.hash).toBe(second.hash);
  });
});
