import { expect, it } from "vitest";
import { createAnswerVersion, finalizeAnswer } from "./answers";
import type { FormField } from "./forms";

const field: FormField = {
  id: "field-1",
  label: "Why?",
  type: "textarea",
  required: true,
  maxChars: 100,
  sensitive: false
};

it("keeps generated answers as drafts until owner confirmation", () => {
  const draft = createAnswerVersion(field, "A grounded answer", "generated");
  expect(draft.status).toBe("draft");
  expect(() => finalizeAnswer(draft, false)).toThrow("OWNER_CONFIRMATION_REQUIRED");
  expect(finalizeAnswer(draft, true).status).toBe("final");
});
