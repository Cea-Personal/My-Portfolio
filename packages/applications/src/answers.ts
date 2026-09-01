import { validateAnswer, type FormField } from "./forms";
export interface AnswerVersion {
  id: string;
  fieldId: string;
  text: string;
  source: "generated" | "owner" | "adapted";
  status: "draft" | "owner_reviewed" | "final";
  version: number;
}
export function createAnswerVersion(
  field: FormField,
  text: string,
  source: AnswerVersion["source"],
  version = 1
): AnswerVersion {
  const valid = validateAnswer(field, text);
  if (!valid.valid) throw new Error(valid.reason);
  return { id: crypto.randomUUID(), fieldId: field.id, text, source, status: "draft", version };
}
export function finalizeAnswer(answer: AnswerVersion, confirmed: boolean): AnswerVersion {
  if (!confirmed) throw new Error("OWNER_CONFIRMATION_REQUIRED");
  return { ...answer, status: "final" };
}
