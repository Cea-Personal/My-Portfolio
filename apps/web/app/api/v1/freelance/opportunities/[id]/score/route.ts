import { calculateFreelanceScore, FREELANCE_SCORE_WEIGHTS, type FreelanceScoreFactors, type FreelanceScoreWeights } from "@career-os/freelance";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { getFreelanceOpportunity } from "@/lib/server/freelance-opportunities";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const opportunity = await getFreelanceOpportunity(client, ownerId, id);
    if (!opportunity) return apiResponse(null, request, 404);
    const latestAnalysis = opportunity.analyses?.[0] as { id?: string } | undefined;
    const matches = opportunity.evidenceMatches as Array<{ support_class?: string; evidence_handles?: unknown }>;
    const classValue: Record<string, number> = { direct: 100, transferable: 70, related: 45, weak: 20, contradictory: 0, missing: 0 };
    const supported = matches.map((match) => ({
      value: classValue[match.support_class ?? "missing"] ?? 0,
      hasEvidence: Array.isArray(match.evidence_handles) && match.evidence_handles.length > 0
    }));
    const factors: Partial<FreelanceScoreFactors> = {};
    if (supported.length) {
      factors.technicalFit = Math.round(supported.reduce((sum, item) => sum + item.value, 0) / supported.length);
      factors.evidenceStrength = Math.round(supported.filter((item) => item.hasEvidence).length / supported.length * 100);
    }
    const latestAnalysisPayload = (opportunity.analyses?.[0] as { observed?: { listingRequirements?: unknown; deliverables?: unknown } } | undefined)?.observed;
    const requirementRows = Array.isArray(latestAnalysisPayload?.listingRequirements) ? latestAnalysisPayload.listingRequirements.length : 0;
    const deliverableRows = Array.isArray(latestAnalysisPayload?.deliverables) ? latestAnalysisPayload.deliverables.length : 0;
    if (latestAnalysis) factors.scopeClarity = requirementRows + deliverableRows > 0 ? Math.min(100, 50 + (requirementRows + deliverableRows) * 5) : 30;
    const latestPricing = opportunity.pricing?.[0] as { recommended_amount?: number; target_effective_rate?: number } | undefined;
    const budgetMax = opportunity.budget_max == null ? Number.NaN : Number(opportunity.budget_max);
    const hourlyMax = opportunity.hourly_max == null ? Number.NaN : Number(opportunity.hourly_max);
    if (latestPricing && opportunity.budget_type === "fixed" && Number.isFinite(budgetMax) && latestPricing.recommended_amount) {
      factors.budgetEconomics = Math.round(Math.max(0, Math.min(100, budgetMax / latestPricing.recommended_amount * 100)));
    } else if (latestPricing && opportunity.budget_type === "hourly" && Number.isFinite(hourlyMax) && latestPricing.target_effective_rate) {
      factors.budgetEconomics = Math.round(Math.max(0, Math.min(100, hourlyMax / latestPricing.target_effective_rate * 100)));
    }
    const configuration = await client.schema("app").from("freelance_score_configurations").select("weights").eq("owner_id", ownerId).maybeSingle();
    if (configuration.error) throw configuration.error;
    const configuredWeights = (configuration.data?.weights ?? FREELANCE_SCORE_WEIGHTS) as FreelanceScoreWeights;
    const score = calculateFreelanceScore(factors, configuredWeights);
    const inserted = await client.schema("app").from("freelance_opportunity_scores").insert({
      owner_id: ownerId,
      opportunity_id: id,
      analysis_id: latestAnalysis?.id ?? null,
      technical_fit: score.factors.technicalFit ?? null,
      evidence_strength: score.factors.evidenceStrength ?? null,
      budget_economics: score.factors.budgetEconomics ?? null,
      win_probability: score.factors.winProbability ?? null,
      client_quality: score.factors.clientQuality ?? null,
      strategic_value: score.factors.strategicValue ?? null,
      scope_clarity: score.factors.scopeClarity ?? null,
      delivery_risk: score.factors.deliveryRisk ?? null,
      weights: score.weights,
      unknown_factors: score.unknownFactors,
      total_score: score.totalScore,
      evidence_coverage: score.evidenceCoverage,
      recommendation: score.recommendation,
      explanation: { unknownFactors: score.unknownFactors, evidenceMatches: matches.length, pricingInputsUsed: Boolean(factors.budgetEconomics), source: "deterministic" },
      calculation_version: score.calculationVersion
    }).select("*").single();
    if (inserted.error || !inserted.data) throw inserted.error ?? new Error("FREELANCE_SCORE_FAILED");
    return apiResponse({ score: inserted.data }, request, 201);
  });
}
