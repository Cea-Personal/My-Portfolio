import { FREELANCE_SCORE_WEIGHTS, type FreelanceScoreWeights } from "@career-os/freelance";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

const keys = Object.keys(FREELANCE_SCORE_WEIGHTS) as (keyof FreelanceScoreWeights)[];

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const result = await client.schema("app").from("freelance_score_configurations").select("weights,updated_at").eq("owner_id", ownerId).maybeSingle();
    if (result.error) throw result.error;
    return apiResponse({ weights: result.data?.weights ?? FREELANCE_SCORE_WEIGHTS, updatedAt: result.data?.updated_at ?? null }, request);
  });
}

export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const parsed = await request.json().catch(() => ({}));
    const body = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
    const values = body.weights && typeof body.weights === "object" ? body.weights as Record<string, unknown> : {};
    if (keys.some((key) => typeof values[key] !== "number" || !Number.isFinite(values[key]) || (values[key] as number) < 0))
      return apiResponse({ code: "INVALID_SCORE_WEIGHTS", detail: "All eight score weights must be non-negative numbers." }, request, 400);
    const weights = Object.fromEntries(keys.map((key) => [key, values[key] as number])) as FreelanceScoreWeights;
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(total - 100) > 1e-8)
      return apiResponse({ code: "SCORE_WEIGHTS_MUST_SUM_TO_100", detail: `Weights currently total ${total}; adjust them to total 100.` }, request, 400);
    const result = await client.schema("app").from("freelance_score_configurations").upsert({ owner_id: ownerId, weights, updated_at: new Date().toISOString() }).select("weights,updated_at").single();
    if (result.error || !result.data) throw result.error ?? new Error("SCORE_CONFIGURATION_SAVE_FAILED");
    return apiResponse({ weights: result.data.weights, updatedAt: result.data.updated_at }, request);
  });
}
