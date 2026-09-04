export type CompensationPeriod = "annual" | "monthly" | "hourly" | "daily";
export type CompensationStrategy =
  | "conservative"
  | "market_competitive"
  | "aggressive"
  | "maximum_reasonable";
export interface BenchmarkInput {
  title: string;
  sourceUrl: string;
  value: number;
  currency: string;
  period: CompensationPeriod;
  observedAt: string;
  evidenceTier:
    | "same_company_role"
    | "same_company_similar"
    | "same_role_city"
    | "same_role_country"
    | "comparable_market";
  context?: string;
}
export interface CompensationAnalysis {
  observedMin: number;
  observedMax: number;
  benchmark: number;
  floor: number;
  target: number;
  stretch: number;
  currency: string;
  period: "annual";
  confidence: "high" | "medium" | "low";
  strategy: CompensationStrategy;
  assumptions: string[];
  normalized: Array<BenchmarkInput & { annualValue: number; conversion: string }>;
}
const periodFactor: Record<CompensationPeriod, number> = {
  annual: 1,
  monthly: 12,
  hourly: 2080,
  daily: 260
};
const strategyFactor: Record<CompensationStrategy, number> = {
  conservative: 0.95,
  market_competitive: 1,
  aggressive: 1.1,
  maximum_reasonable: 1.2
};

export function analyzeCompensation(
  inputs: readonly BenchmarkInput[],
  strategy: CompensationStrategy
): CompensationAnalysis {
  if (!inputs.length) throw new Error("COMPENSATION_EVIDENCE_REQUIRED");
  const currency = inputs[0]?.currency.toUpperCase();
  if (!currency || inputs.some((item) => item.currency.toUpperCase() !== currency))
    throw new Error("EXPLICIT_CURRENCY_CONVERSION_REQUIRED");
  const normalized = inputs
    .map((item) => {
      if (!Number.isFinite(item.value) || item.value <= 0)
        throw new Error("INVALID_COMPENSATION_VALUE");
      if (!Object.hasOwn(periodFactor, item.period)) throw new Error("INVALID_COMPENSATION_PERIOD");
      if (
        ![
          "same_company_role",
          "same_company_similar",
          "same_role_city",
          "same_role_country",
          "comparable_market"
        ].includes(item.evidenceTier)
      )
        throw new Error("INVALID_EVIDENCE_TIER");
      const url = new URL(item.sourceUrl);
      if (url.protocol !== "https:") throw new Error("HTTPS_SOURCE_REQUIRED");
      if (Number.isNaN(Date.parse(item.observedAt))) throw new Error("INVALID_OBSERVED_DATE");
      return {
        ...item,
        currency,
        annualValue: item.value * periodFactor[item.period],
        conversion:
          item.period === "annual"
            ? "No period conversion"
            : `${item.period} × ${String(periodFactor[item.period])} working-period assumption`
      };
    })
    .sort((a, b) => a.annualValue - b.annualValue);
  const values = normalized.map((item) => item.annualValue);
  const middle = Math.floor(values.length / 2);
  const benchmark =
    values.length % 2
      ? (values[middle] ?? 0)
      : ((values[middle - 1] ?? 0) + (values[middle] ?? 0)) / 2;
  const target = benchmark * strategyFactor[strategy];
  const strong = normalized.filter((item) =>
    ["same_company_role", "same_company_similar", "same_role_city"].includes(item.evidenceTier)
  ).length;
  const confidence =
    normalized.length >= 4 && strong >= 2 ? "high" : normalized.length >= 2 ? "medium" : "low";
  return {
    observedMin: values[0] ?? 0,
    observedMax: values.at(-1) ?? 0,
    benchmark,
    floor: Math.min(benchmark * 0.9, target),
    target,
    stretch: Math.max(values.at(-1) ?? target, target * 1.1),
    currency,
    period: "annual",
    confidence,
    strategy,
    assumptions: [
      "All evidence normalized to annual cash value.",
      "Hourly assumes 2,080 hours/year; daily assumes 260 days/year; monthly assumes 12 months.",
      "Bonus, equity, B2B, freelance, tax, and benefits remain separate unless explicitly included in a source value."
    ],
    normalized
  };
}
