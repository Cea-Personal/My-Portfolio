import type { RequirementPriority } from "./jd-analysis";
export interface RequirementScore {
  id: string;
  priority: RequirementPriority;
  match: number;
  evidence: string[];
  evidenceValue?: number;
  explanation?: string;
  category?: string;
  text?: string;
  outcome?: "direct" | "transferable" | "unsupported" | "insufficient_evidence";
  rationale?: string;
}
export interface JobScore {
  score: string;
  calculationVersion: string;
  requirements: RequirementScore[];
}
export function scoreRequirements(
  requirements: readonly RequirementScore[],
  weights: Partial<Record<RequirementPriority, number>> = { required: 3, preferred: 2, optional: 1 }
): JobScore {
  const denominator =
    requirements.reduce((total, item) => total + (weights[item.priority] ?? 1), 0) || 1;
  const numerator = requirements.reduce(
    (total, item) => total + Math.max(0, Math.min(1, item.match)) * (weights[item.priority] ?? 1),
    0
  );
  return {
    score: (numerator / denominator).toFixed(4),
    calculationVersion: "jd-score.v1",
    requirements: requirements.map((item) => ({
      ...item,
      match: Math.max(0, Math.min(1, item.match))
    }))
  };
}
