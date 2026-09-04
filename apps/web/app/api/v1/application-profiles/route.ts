import { createHash } from "node:crypto";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

const structuredFields = [
  "identity",
  "contact",
  "links",
  "location",
  "workAuthorization",
  "availability",
  "languages",
  "education",
  "certifications"
] as const;
function structured(body: Record<string, unknown>) {
  return Object.fromEntries(
    structuredFields.map((field) => [
      field,
      body[field] ??
        (field === "languages" || field === "education" || field === "certifications" ? [] : {})
    ])
  );
}
function columns(value: ReturnType<typeof structured>) {
  return {
    identity: value.identity,
    contact: value.contact,
    links: value.links,
    location: value.location,
    work_authorization: value.workAuthorization,
    availability: value.availability,
    languages: value.languages,
    education: value.education,
    certifications: value.certifications
  };
}

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("application_profiles")
      .select("*, application_profile_versions(id,version,decision,created_at)")
      .eq("owner_id", ownerId)
      .is("archived_at", null)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return apiResponse({ profiles: data ?? [] }, request);
  });
}

export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 160) : "";
    if (!name) return apiResponse({ code: "PROFILE_NAME_REQUIRED" }, request, 400);
    const snapshot = structured(body);
    if (body.isDefault === true)
      await client
        .schema("app")
        .from("application_profiles")
        .update({ is_default: false })
        .eq("owner_id", ownerId)
        .is("archived_at", null);
    const { data, error } = await client
      .schema("app")
      .from("application_profiles")
      .insert({
        owner_id: ownerId,
        name,
        ...columns(snapshot),
        status: body.approved === true ? "approved" : "draft",
        is_default: body.isDefault === true
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("APPLICATION_PROFILE_CREATE_FAILED");
    const version = await client
      .schema("app")
      .from("application_profile_versions")
      .insert({
        profile_id: data.id,
        version: 1,
        snapshot: {
          name,
          ...snapshot,
          hash: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex")
        },
        decision: body.approved === true ? "approved" : "draft",
        owner_id: ownerId
      });
    if (version.error) throw version.error;
    return apiResponse({ profile: data }, request, 201);
  });
}
