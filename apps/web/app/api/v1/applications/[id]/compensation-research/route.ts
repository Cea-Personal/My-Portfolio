import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import {
  analyzeCompensation,
  type BenchmarkInput,
  type CompensationStrategy
} from "@career-os/compensation";
export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const { data, error } = await client
      .schema("app")
      .from("compensation_recommendations")
      .select("*")
      .eq("application_id", id)
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return apiResponse(data ?? [], request);
  });
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id: applicationId } = await params;
    const { data: application } = await client
      .schema("app")
      .from("applications")
      .select("id")
      .eq("id", applicationId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (!application) return apiResponse(null, request, 404);
    const body = await request.json().catch(() => ({}));
    const inputs = Array.isArray(body.sources) ? (body.sources as BenchmarkInput[]) : [];
    const allowedStrategies: CompensationStrategy[] = [
      "conservative",
      "market_competitive",
      "aggressive",
      "maximum_reasonable"
    ];
    const strategy = allowedStrategies.includes(body.strategy as CompensationStrategy)
      ? (body.strategy as CompensationStrategy)
      : "market_competitive";
    let analysis;
    try {
      analysis = analyzeCompensation(inputs, strategy);
    } catch (error) {
      return apiResponse(
        { code: error instanceof Error ? error.message : "INVALID_COMPENSATION_EVIDENCE" },
        request,
        400
      );
    }
    const sourceIds: string[] = [];
    for (const item of analysis.normalized) {
      const source = await client
        .schema("app")
        .from("compensation_sources")
        .insert({
          owner_id: ownerId,
          title: item.title.slice(0, 300),
          source_url: item.sourceUrl,
          observed_at: item.observedAt,
          license_note: "Owner supplied compensation evidence"
        })
        .select("id")
        .single();
      if (source.error || !source.data)
        throw source.error ?? new Error("COMPENSATION_SOURCE_FAILED");
      sourceIds.push(source.data.id);
      const benchmark = await client
        .schema("app")
        .from("compensation_benchmarks")
        .insert({
          source_id: source.data.id,
          title: item.title.slice(0, 300),
          value: item.annualValue,
          currency: analysis.currency,
          period: "annual",
          confidence: analysis.confidence,
          observed_at: item.observedAt,
          level: item.evidenceTier
        });
      if (benchmark.error) throw benchmark.error;
    }
    const { data, error } = await client
      .schema("app")
      .from("compensation_recommendations")
      .insert({
        owner_id: ownerId,
        application_id: applicationId,
        floor: analysis.floor,
        target: analysis.target,
        stretch: analysis.stretch,
        currency: analysis.currency,
        period: analysis.period,
        confidence: analysis.confidence,
        calculation_version: "compensation.v2",
        observed_min: analysis.observedMin,
        observed_max: analysis.observedMax,
        benchmark: analysis.benchmark,
        strategy,
        assumptions: analysis.assumptions,
        source_ids: sourceIds,
        normalized_evidence: analysis.normalized,
        research_date: new Date().toISOString().slice(0, 10)
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("COMPENSATION_RESEARCH_FAILED");
    return apiResponse({ status: "completed", recommendation: data }, request, 202);
  });
}
