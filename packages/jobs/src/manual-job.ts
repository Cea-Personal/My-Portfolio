import { normalizeJob, type NormalizedJob } from "./normalization";
export function createManualJob(input: {
  company?: string;
  title?: string;
  location?: string;
  description: string;
  canonicalUrl?: string;
}): NormalizedJob {
  if (!input.description.trim()) throw new Error("JOB_DESCRIPTION_REQUIRED");
  return normalizeJob(input);
}
