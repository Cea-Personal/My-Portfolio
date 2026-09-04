export type JobStatus =
  | "discovered"
  | "shortlisted"
  | "interested"
  | "preparing_application"
  | "ready_to_apply"
  | "applied"
  | "recruiter_contact"
  | "interview"
  | "technical_assessment"
  | "final_interview"
  | "offer"
  | "rejected"
  | "withdrawn"
  | "expired";
const transitions: Record<JobStatus, readonly JobStatus[]> = {
  discovered: ["shortlisted", "interested", "withdrawn", "expired"],
  shortlisted: ["interested", "preparing_application", "rejected", "withdrawn", "expired"],
  interested: ["preparing_application", "withdrawn", "expired"],
  preparing_application: ["ready_to_apply", "interested", "withdrawn", "expired"],
  ready_to_apply: ["preparing_application", "applied", "withdrawn", "expired"],
  applied: [
    "recruiter_contact",
    "interview",
    "technical_assessment",
    "rejected",
    "withdrawn",
    "expired"
  ],
  recruiter_contact: [
    "interview",
    "technical_assessment",
    "final_interview",
    "offer",
    "rejected",
    "withdrawn"
  ],
  interview: ["technical_assessment", "final_interview", "offer", "rejected", "withdrawn"],
  technical_assessment: ["final_interview", "offer", "rejected", "withdrawn"],
  final_interview: ["offer", "rejected", "withdrawn"],
  offer: ["withdrawn"],
  rejected: ["shortlisted"],
  withdrawn: ["interested"],
  expired: []
};
export const jobStatuses = Object.freeze(Object.keys(transitions) as JobStatus[]);
export function availableJobTransitions(status: JobStatus): readonly JobStatus[] {
  return transitions[status];
}
export function transitionJob(status: JobStatus, next: JobStatus): JobStatus {
  if (!transitions[status].includes(next))
    throw new Error(`Invalid job transition ${status} -> ${next}`);
  return next;
}
