export interface PreparationKit {
  id: string;
  stageId: string;
  schemaVersion: "interview-kit.v1";
  questions: { question: string; confidence: "high" | "medium" | "low"; evidenceIds: string[] }[];
  gaps: string[];
}
