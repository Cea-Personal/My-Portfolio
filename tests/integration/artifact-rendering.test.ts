import { expect, it } from "vitest";
import { renderPdf } from "@career-os/applications";
it("renders deterministic artifact bytes and hashes", () => {
  const a = renderPdf("content", "modern");
  const b = renderPdf("content", "modern");
  expect(a.hash).toBe(b.hash);
});
