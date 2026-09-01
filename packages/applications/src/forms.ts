export interface FormField {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "date" | "url";
  required: boolean;
  choices?: string[];
  maxChars?: number;
  category?: string;
  sensitive: boolean;
}
export function captureFormFields(fields: readonly FormField[]): FormField[] {
  return fields.map((field) => ({
    ...field,
    sensitive: field.sensitive || /gender|race|ethnicity|disability|demographic/i.test(field.label)
  }));
}
export function validateAnswer(
  field: FormField,
  value: string
): { valid: boolean; reason?: string } {
  if (field.required && !value.trim()) return { valid: false, reason: "REQUIRED" };
  if (field.maxChars && value.length > field.maxChars)
    return { valid: false, reason: "MAX_LENGTH" };
  return { valid: true };
}
