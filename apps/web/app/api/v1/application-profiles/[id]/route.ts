import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const current = await client
      .schema("app")
      .from("application_profiles")
      .select("*")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .is("archived_at", null)
      .maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return apiResponse(null, request, 404);
    const currentRevision = Number.isInteger(current.data.revision)
      ? Number(current.data.revision)
      : 1;
    const nextRevision = currentRevision + 1;
    if (body.isDefault === true)
      await client
        .schema("app")
        .from("application_profiles")
        .update({ is_default: false })
        .eq("owner_id", ownerId)
        .is("archived_at", null)
        .neq("id", id);
    const update = {
      name: typeof body.name === "string" ? body.name.trim().slice(0, 160) : current.data.name,
      identity: body.identity ?? current.data.identity,
      contact: body.contact ?? current.data.contact,
      links: body.links ?? current.data.links,
      location: body.location ?? current.data.location,
      work_authorization: body.workAuthorization ?? current.data.work_authorization,
      availability: body.availability ?? current.data.availability,
      languages: body.languages ?? current.data.languages,
      education: body.education ?? current.data.education,
      certifications: body.certifications ?? current.data.certifications,
      status:
        typeof body.approved === "boolean"
          ? body.approved
            ? "approved"
            : "draft"
          : current.data.status,
      is_default: typeof body.isDefault === "boolean" ? body.isDefault : current.data.is_default,
      revision: nextRevision,
      updated_at: new Date().toISOString()
    };
    const result = await client
      .schema("app")
      .from("application_profiles")
      .update(update)
      .eq("id", id)
      .eq("owner_id", ownerId)
      .eq("revision", currentRevision)
      .select("*")
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return apiResponse({ code: "PROFILE_CHANGED_RELOAD" }, request, 409);
    const version = await client.schema("app").from("application_profile_versions").insert({
      profile_id: id,
      version: nextRevision,
      snapshot: update,
      decision: update.status,
      owner_id: ownerId
    });
    if (version.error) throw version.error;
    return apiResponse({ profile: result.data }, request);
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const current = await client
      .schema("app")
      .from("application_profiles")
      .select("id")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .is("archived_at", null)
      .maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return apiResponse(null, request, 404);

    // Do not leave an archived profile selected on any application.
    const clearSelections = await client
      .schema("app")
      .from("applications")
      .update({ application_profile_id: null })
      .eq("owner_id", ownerId)
      .eq("application_profile_id", id);
    if (clearSelections.error) throw clearSelections.error;

    const archived = await client
      .schema("app")
      .from("application_profiles")
      .update({ archived_at: new Date().toISOString(), is_default: false })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();
    if (archived.error) throw archived.error;
    return apiResponse({ archived: Boolean(archived.data) }, request, archived.data ? 200 : 409);
  });
}
