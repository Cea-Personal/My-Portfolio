import type { FormField } from "./forms";
export function fillFromProfile(
  fields: readonly FormField[],
  profile: Readonly<Record<string, string>>
): Record<string, string> {
  return Object.fromEntries(
    fields.filter((field) => !field.sensitive).map((field) => [field.id, profile[field.id] ?? ""])
  );
}
