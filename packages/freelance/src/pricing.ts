import type { PricingMode, PricingRecommendation } from "./types";

export function calculateFreelancePricing(input: {
  pricingMode: PricingMode;
  currency: string;
  estimatedHours: number;
  targetEffectiveRate: number;
  riskBufferPercent?: number;
  assumptions?: readonly string[];
}): PricingRecommendation {
  if (!input.currency.trim()) throw new Error("PRICING_CURRENCY_REQUIRED");
  if (!Number.isFinite(input.estimatedHours) || input.estimatedHours <= 0)
    throw new Error("ESTIMATED_HOURS_REQUIRED");
  if (!Number.isFinite(input.targetEffectiveRate) || input.targetEffectiveRate <= 0)
    throw new Error("TARGET_EFFECTIVE_RATE_REQUIRED");
  const riskBufferPercent = input.riskBufferPercent ?? 15;
  if (!Number.isFinite(riskBufferPercent) || riskBufferPercent < 0 || riskBufferPercent > 100)
    throw new Error("RISK_BUFFER_INVALID");
  const base = input.estimatedHours * input.targetEffectiveRate;
  const recommendedAmount = Number((base * (1 + riskBufferPercent / 100)).toFixed(2));
  const minimumAmount = Number((base * 0.9).toFixed(2));
  const premiumAmount = Number((recommendedAmount * 1.25).toFixed(2));
  return {
    pricingMode: input.pricingMode,
    currency: input.currency.trim().toUpperCase(),
    estimatedHours: input.estimatedHours,
    targetEffectiveRate: input.targetEffectiveRate,
    riskBufferPercent,
    minimumAmount,
    recommendedAmount,
    premiumAmount,
    calculationVersion: "freelance-pricing.v1",
    assumptions: input.assumptions ?? []
  };
}
