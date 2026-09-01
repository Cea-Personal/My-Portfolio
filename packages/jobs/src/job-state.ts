export type JobStatus =
  | "discovered"
  | "reviewing"
  | "interested"
  | "applied"
  | "archived"
  | "closed";
const transitions: Record<JobStatus, readonly JobStatus[]> = {
  discovered: ["reviewing", "interested", "archived"],
  reviewing: ["interested", "applied", "archived"],
  interested: ["applied", "archived"],
  applied: ["closed", "archived"],
  archived: ["reviewing", "interested"],
  closed: []
};
export function transitionJob(status: JobStatus, next: JobStatus): JobStatus {
  if (!transitions[status].includes(next))
    throw new Error(`Invalid job transition ${status} -> ${next}`);
  return next;
}
