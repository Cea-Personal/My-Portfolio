import type { RequirementScore } from "./jd-score";

export interface CareerMatchSnapshot {
  score: string;
  evidenceIds: string[];
  calculationVersion: "career-match.v1";
}

export function calculateCareerMatch(
  requirements: readonly RequirementScore[]
): CareerMatchSnapshot {
  const evidenceIds = [...new Set(requirements.flatMap((item) => item.evidence))].sort();
  const score =
    requirements.length === 0
      ? "0.0000"
      : (
          requirements.reduce((sum, item) => sum + Math.max(0, Math.min(1, item.match)), 0) /
          requirements.length
        ).toFixed(4);
  return { score, evidenceIds, calculationVersion: "career-match.v1" };
}
