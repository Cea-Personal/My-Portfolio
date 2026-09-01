export type ApplicationStatus =
  | "draft"
  | "in_progress"
  | "submitted"
  | "interviewing"
  | "offer"
  | "closed";
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
  if (status === "submitted" && application.status === "draft")
    return { ...application, status, revision: application.revision + 1 };
  if (status === "in_progress" && application.status === "draft")
    return { ...application, status, revision: application.revision + 1 };
  throw new Error("INVALID_APPLICATION_TRANSITION");
}
