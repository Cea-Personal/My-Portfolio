import { expect, it } from "vitest";
import { createPrivateObjectKey, validateUploadMetadata } from "@career-os/documents";

it("requires bounded private document uploads", () => {
  validateUploadMetadata({ filename: "resume.txt", mediaType: "text/plain", size: 10 });
  expect(createPrivateObjectKey("owner", "document", 1)).toBe("owner/documents/document/v1");
  expect(() =>
    validateUploadMetadata({ filename: "../secret", mediaType: "text/plain", size: 10 })
  ).toThrow();
});
