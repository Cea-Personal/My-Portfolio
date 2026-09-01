import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("career_facts")
      .select("*")
      .eq("owner_id", ownerId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return apiResponse(data ?? [], request);
  });
}
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    if (typeof body.statement !== "string" || !body.statement.trim())
      return apiResponse({ code: "INVALID_FACT", detail: "statement is required" }, request, 400);
    const { data: fact, error } = await client
      .schema("app")
      .from("career_facts")
      .insert({
        owner_id: ownerId,
        fact_type: typeof body.factType === "string" ? body.factType : "achievement",
        subject_type: typeof body.subjectType === "string" ? body.subjectType : "career",
        subject_id: typeof body.subjectId === "string" ? body.subjectId : crypto.randomUUID(),
        visibility: body.visibility === "public" ? "public" : "private",
        review_status: "candidate",
        trust_level: "owner_verified",
        verified_by_owner: false
      })
      .select("*")
      .single();
    if (error || !fact) throw error ?? new Error("FACT_CREATE_FAILED");
    const { data: version, error: versionError } = await client
      .schema("app")
      .from("career_fact_versions")
      .insert({
        fact_id: fact.id,
        version: 1,
        statement: body.statement.trim().slice(0, 10_000),
        structured_value:
          typeof body.structuredValue === "object" && body.structuredValue !== null
            ? body.structuredValue
            : {},
        source_type: typeof body.sourceType === "string" ? body.sourceType : "manual",
        editor_actor: "owner",
        content_hash: await crypto.subtle
          .digest("SHA-256", new TextEncoder().encode(body.statement.trim()))
          .then((bytes) =>
            Array.from(new Uint8Array(bytes))
              .map((byte) => byte.toString(16).padStart(2, "0"))
              .join("")
          )
      })
      .select("*")
      .single();
    if (versionError || !version) throw versionError ?? new Error("FACT_VERSION_CREATE_FAILED");
    const { data: updated, error: updateError } = await client
      .schema("app")
      .from("career_facts")
      .update({ current_version_id: version.id })
      .eq("id", fact.id)
      .eq("owner_id", ownerId)
      .select("*")
      .single();
    if (updateError || !updated) throw updateError ?? new Error("FACT_CREATE_FAILED");
    return apiResponse({ ...updated, currentVersion: version }, request, 201);
  });
}
