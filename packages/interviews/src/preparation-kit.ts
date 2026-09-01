import type { PreparationKit } from "./schemas";
export function createPreparationKit(
  stageId: string,
  questions: PreparationKit["questions"],
  gaps: string[] = []
): PreparationKit {
  return { id: crypto.randomUUID(), stageId, schemaVersion: "interview-kit.v1", questions, gaps };
}
