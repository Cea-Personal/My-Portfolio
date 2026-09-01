import { extractRequirements, type JobRequirement } from "./jd-analysis";

export interface PrivateJobAnalysis {
  schemaVersion: "private-job-analysis.v1";
  requirements: JobRequirement[];
  evidenceScope: "owner_private";
}

export function analyzePrivateJob(description: string): PrivateJobAnalysis {
  return {
    schemaVersion: "private-job-analysis.v1",
    requirements: extractRequirements(description),
    evidenceScope: "owner_private"
  };
}
