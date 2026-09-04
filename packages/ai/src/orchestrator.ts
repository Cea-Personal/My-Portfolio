export type WorkflowPurpose =
  | "drive_sync"
  | "ingestion"
  | "job_search"
  | "artifact_draft"
  | "analytics_aggregate"
  | "export";
export type ReasoningTask =
  | "public_qa"
  | "role_fit"
  | "evidence_extraction"
  | "career_gap"
  | "job_scoring"
  | "document_composition"
  | "compensation"
  | "interview_preparation"
  | "writing_assistance";
export type CoordinatedTask = WorkflowPurpose | ReasoningTask;
const allowed = new Set<WorkflowPurpose>([
  "drive_sync",
  "ingestion",
  "job_search",
  "artifact_draft",
  "analytics_aggregate",
  "export"
]);
export function assertWorkflowPurpose(purpose: string): asserts purpose is WorkflowPurpose {
  if (!allowed.has(purpose as WorkflowPurpose)) throw new Error("WORKFLOW_PURPOSE_NOT_ALLOWED");
}
const reasoning = new Set<ReasoningTask>([
  "public_qa",
  "role_fit",
  "evidence_extraction",
  "career_gap",
  "job_scoring",
  "document_composition",
  "compensation",
  "interview_preparation",
  "writing_assistance"
]);
export function coordinateTask(task: string) {
  if (allowed.has(task as WorkflowPurpose))
    return {
      task: task as WorkflowPurpose,
      execution: "deterministic" as const,
      consequential: ["artifact_draft", "export"].includes(task)
    };
  if (reasoning.has(task as ReasoningTask))
    return {
      task: task as ReasoningTask,
      execution: "reasoning" as const,
      consequential: ["document_composition"].includes(task)
    };
  throw new Error("COORDINATED_TASK_NOT_ALLOWED");
}
