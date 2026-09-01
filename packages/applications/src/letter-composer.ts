import type { LetterData } from "./artifact-schemas";
export function composeLetter(input: Omit<LetterData, "schemaVersion">): LetterData {
  return { ...input, schemaVersion: "letter.v1" };
}
