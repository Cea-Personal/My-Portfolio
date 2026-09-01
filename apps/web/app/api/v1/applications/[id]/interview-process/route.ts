import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id: applicationId } = await params;
    const { data, error } = await client
      .schema("app")
      .from("interview_processes")
      .select("*, interview_stages(*)")
      .eq("application_id", applicationId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) throw error;
    return apiResponse(
      data
        ? { stages: data.interview_stages ?? [], confidence: data.confidence, process: data }
        : { stages: [], confidence: "low" },
      request
    );
  });
}
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    if (typeof body.applicationId !== "string")
      return apiResponse({ code: "APPLICATION_REQUIRED" }, request, 400);
    const { data: application } = await client
      .schema("app")
      .from("applications")
      .select("id")
      .eq("id", body.applicationId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (!application) return apiResponse(null, request, 404);
    const { data, error } = await client
      .schema("app")
      .from("interview_processes")
      .insert({ application_id: body.applicationId, owner_id: ownerId, confidence: "low" })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("INTERVIEW_PROCESS_CREATE_FAILED");
    return apiResponse(data, request, 201);
  });
}
