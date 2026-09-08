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
  | "application_answers"
  | "compensation"
  | "interview_preparation"
  | "writing_assistance";
export type CoordinatedTask = WorkflowPurpose | ReasoningTask;

/**
 * A subagent is a bounded role prompt and tool policy, not a separate model.
 * Every reasoning role is executed by the owner's single orchestrator model.
 */
export type SubagentRole = ReasoningTask;

export const subagentRoles: ReadonlyArray<{
  task: SubagentRole;
  label: string;
  description: string;
}> = [
  {
    task: "public_qa",
    label: "Portfolio assistant",
    description: "Answers public questions from published evidence."
  },
  {
    task: "role_fit",
    label: "Role-fit analyst",
    description: "Maps a job description to verified experience and skills."
  },
  {
    task: "evidence_extraction",
    label: "Career synthesizer",
    description: "Turns source documents into structured career evidence."
  },
  {
    task: "career_gap",
    label: "Career gap analyst",
    description: "Identifies missing evidence and useful next steps."
  },
  { task: "job_scoring", label: "Job matcher", description: "Scores and explains job matches." },
  {
    task: "document_composition",
    label: "Application writer",
    description: "Drafts CVs, cover letters, and application answers."
  },
  {
    task: "application_answers",
    label: "Application answer writer",
    description: "Answers the exact employer questions for one application."
  },
  {
    task: "compensation",
    label: "Compensation analyst",
    description: "Summarizes compensation evidence and trade-offs."
  },
  {
    task: "interview_preparation",
    label: "Interview coach",
    description: "Builds stage-aware interview preparation."
  },
  {
    task: "writing_assistance",
    label: "Writing editor",
    description: "Helps shape clear, evidence-backed writing."
  }
];

export function subagentForTask(task: string) {
  return subagentRoles.find((role) => role.task === task) ?? null;
}
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
  "application_answers",
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
      delegation: "subagent" as const,
      orchestrator: "single_model" as const,
      subagent: subagentForTask(task),
      consequential: ["document_composition", "application_answers"].includes(task)
    };
  throw new Error("COORDINATED_TASK_NOT_ALLOWED");
}
