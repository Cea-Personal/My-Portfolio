export type ApplicationStatus =
  | "draft"
  | "in_progress"
  | "ready"
  | "submitted"
  | "interviewing"
  | "offer"
  | "closed"
  | "withdrawn";
export interface Application {
  id: string;
  ownerId: string;
  jobId: string;
  status: ApplicationStatus;
  revision: number;
}
export function createApplication(ownerId: string, jobId: string): Application {
  return { id: crypto.randomUUID(), ownerId, jobId, status: "draft", revision: 0 };
}
export function transitionApplication(
  application: Application,
  status: ApplicationStatus,
  expectedRevision: number
): Application {
  if (application.revision !== expectedRevision) throw new Error("REVISION_CONFLICT");
  const transitions: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
    draft: ["in_progress", "withdrawn"],
    in_progress: ["ready", "submitted", "withdrawn"],
    ready: ["in_progress", "submitted", "withdrawn"],
    submitted: ["interviewing", "offer", "closed", "withdrawn"],
    interviewing: ["offer", "closed", "withdrawn"],
    offer: ["closed", "withdrawn"],
    closed: [],
    withdrawn: ["in_progress"]
  };
  if (!transitions[application.status].includes(status))
    throw new Error("INVALID_APPLICATION_TRANSITION");
  return { ...application, status, revision: application.revision + 1 };
}
export const applicationStatuses: readonly ApplicationStatus[] = [
  "draft",
  "in_progress",
  "ready",
  "submitted",
  "interviewing",
  "offer",
  "closed",
  "withdrawn"
];
