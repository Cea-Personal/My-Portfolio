import {
  FREELANCE_SCORE_WEIGHTS,
  type FreelanceScoreWeights,
  type FreelanceOpportunityScore,
  type FreelanceRecommendation,
  type FreelanceScoreFactors
} from "./types";

function bounded(value: number): number {
  if (!Number.isFinite(value)) throw new Error("SCORE_FACTOR_MUST_BE_FINITE");
  return Math.max(0, Math.min(100, value));
}

export function freelanceRecommendation(score: number): FreelanceRecommendation {
  if (score >= 85) return "APPLY_NOW";
  if (score >= 70) return "APPLY";
  if (score >= 55) return "CONSIDER";
  if (score >= 35) return "LOW_PRIORITY";
  return "SKIP";
}

export function calculateFreelanceScore(
  factors: Partial<FreelanceScoreFactors>,
  weights: Partial<FreelanceScoreWeights> = FREELANCE_SCORE_WEIGHTS
): FreelanceOpportunityScore {
  const configuredWeights = Object.fromEntries(
    Object.keys(FREELANCE_SCORE_WEIGHTS).map((key) => {
      const factor = key as keyof typeof FREELANCE_SCORE_WEIGHTS;
      return [factor, weights[factor] ?? FREELANCE_SCORE_WEIGHTS[factor]];
    })
  ) as FreelanceScoreWeights;
  const weightTotal = Object.values(configuredWeights).reduce((sum, value) => sum + value, 0);
  if (Object.values(configuredWeights).some((value) => !Number.isFinite(value) || value < 0) || Math.abs(weightTotal - 100) > 1e-8)
    throw new Error("SCORE_WEIGHTS_MUST_BE_NONNEGATIVE_AND_SUM_TO_100");
  const normalized: Partial<FreelanceScoreFactors> = {};
  for (const key of Object.keys(FREELANCE_SCORE_WEIGHTS) as (keyof FreelanceScoreFactors)[]) {
    const value = factors[key];
    if (value !== undefined) normalized[key] = bounded(value);
  }
  const knownKeys = Object.keys(normalized) as (keyof FreelanceScoreFactors)[];
  const knownWeight = knownKeys.reduce((sum, key) => sum + configuredWeights[key], 0);
  if (!knownWeight) throw new Error("SCORE_REQUIRES_KNOWN_FACTORS");
  const totalScore = Math.round(
    knownKeys.reduce(
      (total, key) => total + (normalized[key] ?? 0) * configuredWeights[key],
      0
    ) / knownWeight
  );
  const unknownFactors = (Object.keys(FREELANCE_SCORE_WEIGHTS) as (keyof FreelanceScoreFactors)[])
    .filter((key) => normalized[key] === undefined);
  return {
    factors: normalized,
    weights: configuredWeights,
    unknownFactors,
    totalScore,
    evidenceCoverage: Number((knownWeight / 100).toFixed(2)),
    recommendation: knownWeight < 70 ? "CONSIDER" : freelanceRecommendation(totalScore),
    calculationVersion: "freelance-opportunity-score.v1"
  };
}
