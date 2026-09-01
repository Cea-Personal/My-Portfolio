import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("jobs")
      .select("*")
      .eq("owner_id", ownerId)
      .order("discovered_at", { ascending: false });
    if (error) throw error;
    return apiResponse({ jobs: data ?? [] }, request);
  });
}
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    if (typeof body.title !== "string" || typeof body.company !== "string")
      return apiResponse(
        { code: "INVALID_JOB", detail: "company and title are required" },
        request,
        400
      );
    const { data, error } = await client
      .schema("app")
      .from("jobs")
      .insert({
        owner_id: ownerId,
        canonical_company: body.company.trim().slice(0, 240),
        canonical_title: body.title.trim().slice(0, 240),
        location: typeof body.location === "string" ? body.location.slice(0, 240) : null,
        current_description:
          typeof body.description === "string" ? body.description.slice(0, 50000) : null,
        normalized_fingerprint:
          typeof body.fingerprint === "string" ? body.fingerprint : crypto.randomUUID(),
        status: "discovered"
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("JOB_CREATE_FAILED");
    return apiResponse({ job: data }, request, 201);
  });
}
