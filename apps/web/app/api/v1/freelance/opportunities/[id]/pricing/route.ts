import { calculateFreelancePricing, type PricingMode } from "@career-os/freelance";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { getFreelanceOpportunity } from "@/lib/server/freelance-opportunities";

export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const result = await client.schema("app").from("freelance_pricing_recommendations").select("*").eq("owner_id", ownerId).eq("opportunity_id", id).order("created_at", { ascending: false });
    if (result.error) throw result.error;
    return apiResponse({ pricing: result.data ?? [] }, request);
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const opportunity = await getFreelanceOpportunity(client, ownerId, id);
    if (!opportunity) return apiResponse(null, request, 404);
    const parsed = await request.json().catch(() => ({}));
    const body = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    if (typeof body.pricingMode !== "string" || typeof body.currency !== "string" || typeof body.estimatedHours !== "number" || typeof body.targetEffectiveRate !== "number")
      return apiResponse({ code: "PRICING_INPUTS_REQUIRED", detail: "pricingMode, currency, estimatedHours, and targetEffectiveRate are required" }, request, 400);
    if (!["hourly", "fixed", "milestone"].includes(body.pricingMode))
      return apiResponse({ code: "INVALID_PRICING_MODE" }, request, 400);
    let pricing: ReturnType<typeof calculateFreelancePricing>;
    try {
      pricing = calculateFreelancePricing({
        pricingMode: body.pricingMode as PricingMode,
        currency: body.currency,
        estimatedHours: body.estimatedHours,
        targetEffectiveRate: body.targetEffectiveRate,
        ...(typeof body.riskBufferPercent === "number" ? { riskBufferPercent: body.riskBufferPercent } : {}),
        ...(Array.isArray(body.assumptions) ? { assumptions: body.assumptions.filter((value): value is string => typeof value === "string").slice(0, 30).map((value) => value.slice(0, 500)) } : {})
      });
    } catch (error) {
      return apiResponse({ code: error instanceof Error ? error.message : "INVALID_PRICING_INPUT" }, request, 400);
    }
    const inserted = await client.schema("app").from("freelance_pricing_recommendations").insert({
      owner_id: ownerId,
      opportunity_id: id,
      analysis_id: opportunity.analyses?.[0]?.id ?? null,
      currency: pricing.currency,
      pricing_mode: pricing.pricingMode,
      estimated_hours: pricing.estimatedHours,
      target_effective_rate: pricing.targetEffectiveRate,
      risk_buffer_percent: pricing.riskBufferPercent,
      minimum_amount: pricing.minimumAmount,
      recommended_amount: pricing.recommendedAmount,
      premium_amount: pricing.premiumAmount,
      assumptions: pricing.assumptions,
      evidence_snapshot: {},
      calculation_version: pricing.calculationVersion
    }).select("*").single();
    if (inserted.error || !inserted.data) throw inserted.error ?? new Error("FREELANCE_PRICING_FAILED");
    return apiResponse({ pricing: inserted.data }, request, 201);
  });
}
