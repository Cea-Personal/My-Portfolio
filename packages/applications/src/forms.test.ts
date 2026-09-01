import { expect, it } from "vitest";
import { captureFormFields, validateAnswer } from "./forms";
it("keeps demographic fields manual-only", () => {
  const field = captureFormFields([
    { id: "race", label: "Race", type: "text", required: false, sensitive: false }
  ])[0]!;
  expect(field.sensitive).toBe(true);
  expect(validateAnswer(field, "").valid).toBe(true);
});
