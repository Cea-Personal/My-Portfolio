export interface CompensationRecommendation {
  floor: string;
  target: string;
  stretch: string;
  currency: string;
  period: "annual" | "monthly" | "hourly";
  confidence: "high" | "medium" | "low";
  calculationVersion: string;
}
export function recommendCompensation(input: {
  benchmark: string;
  currency: string;
  period: CompensationRecommendation["period"];
  confidence?: CompensationRecommendation["confidence"];
}): CompensationRecommendation {
  const base = Number(input.benchmark);
  if (!Number.isFinite(base) || base <= 0) throw new Error("INSUFFICIENT_COMPENSATION_EVIDENCE");
  return {
    floor: base.toFixed(2),
    target: (base * 1.1).toFixed(2),
    stretch: (base * 1.25).toFixed(2),
    currency: input.currency,
    period: input.period,
    confidence: input.confidence ?? "low",
    calculationVersion: "compensation.v1"
  };
}
