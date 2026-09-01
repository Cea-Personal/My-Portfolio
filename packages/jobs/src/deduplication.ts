import type { NormalizedJob } from "./normalization";
export function deduplicationKey(job: NormalizedJob): string {
  return job.canonicalUrl ? `url:${job.canonicalUrl}` : `fingerprint:${job.fingerprint}`;
}
export function similarity(a: NormalizedJob, b: NormalizedJob): number {
  let score = 0;
  if (a.company.toLowerCase() === b.company.toLowerCase()) score += 0.4;
  if (a.title.toLowerCase() === b.title.toLowerCase()) score += 0.4;
  if (a.location?.toLowerCase() === b.location?.toLowerCase()) score += 0.2;
  return score;
}
export function shouldMerge(a: NormalizedJob, b: NormalizedJob, threshold = 0.8): boolean {
  return deduplicationKey(a) === deduplicationKey(b) || similarity(a, b) >= threshold;
}
