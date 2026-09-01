import { assertRevision, nextRevision } from "../revision";

export type RunStatus = "pending" | "running" | "completed" | "partial" | "failed" | "cancelled";
export interface AutomationRun {
  id: string;
  ownerId: string;
  status: RunStatus;
  revision: number;
  correlationId: string;
  idempotencyKey: string;
}

const transitions: Record<RunStatus, readonly RunStatus[]> = {
  pending: ["running", "cancelled"],
  running: ["completed", "partial", "failed", "cancelled"],
  completed: [],
  partial: [],
  failed: [],
  cancelled: []
};

export function transitionRun(
  run: AutomationRun,
  status: RunStatus,
  expectedRevision: number
): AutomationRun {
  assertRevision(run.revision, expectedRevision);
  if (!transitions[run.status].includes(status))
    throw new Error(`Invalid run transition ${run.status} -> ${status}`);
  return { ...run, status, revision: nextRevision(run.revision) };
}
