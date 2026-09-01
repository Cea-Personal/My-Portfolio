export interface OpportunityFactors {
  alignment: number;
  growth: number;
  compensation: number;
  logistics: number;
}

export interface OpportunityScore {
  score: string;
  calculationVersion: "opportunity-score.v1";
  weights: OpportunityFactors;
}

export function calculateOpportunityScore(
  factors: OpportunityFactors,
  weights: Partial<OpportunityFactors> = {}
): OpportunityScore {
  const applied = { alignment: 0.4, growth: 0.25, compensation: 0.2, logistics: 0.15, ...weights };
  const score = (Object.keys(applied) as (keyof OpportunityFactors)[]).reduce(
    (total, key) => total + Math.max(0, Math.min(1, factors[key])) * applied[key],
    0
  );
  return { score: score.toFixed(4), calculationVersion: "opportunity-score.v1", weights: applied };
}
