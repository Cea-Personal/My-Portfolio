import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const { data, error } = await client
      .schema("app")
      .from("applications")
      .select(
        "*, jobs(*), application_status_history(*), application_required_materials(*), application_forms(*, application_fields(*, application_answer_versions(*))), application_documents(*), application_packages(*, application_package_items(*)), generated_artifacts(*, artifact_versions(*)), compensation_recommendations(*)"
      )
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) throw error;
    return apiResponse(data, request, data ? 200 : 404);
  });
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { data: current, error: currentError } = await client
      .schema("app")
      .from("applications")
      .select("revision, status")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) return apiResponse(null, request, 404);
    const currentRevision =
      typeof current.revision === "number" && Number.isInteger(current.revision)
        ? current.revision
        : 0;
    if (Number.isInteger(body.revision) && body.revision !== current.revision)
      return apiResponse(
        { code: "REVISION_CONFLICT", detail: "The application changed since it was loaded" },
        request,
        409
      );
    const nextStatus = typeof body.status === "string" ? body.status : current.status;
    let applicationProfileId: string | null | undefined;
    if (body.applicationProfileId !== undefined) {
      if (body.applicationProfileId === null || body.applicationProfileId === "") {
        applicationProfileId = null;
      } else if (typeof body.applicationProfileId === "string") {
        const profile = await client
          .schema("app")
          .from("application_profiles")
          .select("id,status")
          .eq("id", body.applicationProfileId)
          .eq("owner_id", ownerId)
          .is("archived_at", null)
          .maybeSingle();
        if (profile.error) throw profile.error;
        if (!profile.data || profile.data.status !== "approved")
          return apiResponse(
            {
              code: "APPLICATION_PROFILE_NOT_APPROVED",
              detail: "Select an approved application profile or clear the selection."
            },
            request,
            409
          );
        applicationProfileId = profile.data.id;
      } else {
        return apiResponse({ code: "INVALID_APPLICATION_PROFILE" }, request, 400);
      }
    }
    const { data, error } = await client
      .schema("app")
      .from("applications")
      .update({
        status: nextStatus,
        notes: typeof body.notes === "string" ? body.notes.slice(0, 10000) : undefined,
        ...(applicationProfileId !== undefined
          ? { application_profile_id: applicationProfileId }
          : {}),
        revision: currentRevision + 1
      })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .eq("revision", currentRevision)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return apiResponse(data, request, data ? 200 : 409);
  });
}
