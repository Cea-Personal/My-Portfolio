export type WorkflowPurpose =
  | "drive_sync"
  | "ingestion"
  | "job_search"
  | "artifact_draft"
  | "analytics_aggregate"
  | "export";
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
