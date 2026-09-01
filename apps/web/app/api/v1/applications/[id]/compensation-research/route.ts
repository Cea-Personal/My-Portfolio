import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
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
    const { data, error } = await client
      .schema("app")
      .from("compensation_recommendations")
      .insert({
        owner_id: ownerId,
        application_id: applicationId,
        floor: Number(body.floor ?? 0),
        target: Number(body.target ?? 0),
        stretch: Number(body.stretch ?? 0),
        currency: typeof body.currency === "string" ? body.currency : "USD",
        period: typeof body.period === "string" ? body.period : "year",
        confidence: "low",
        calculation_version: "compensation.v1"
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("COMPENSATION_RESEARCH_FAILED");
    return apiResponse({ status: "completed", recommendation: data }, request, 202);
  });
}
