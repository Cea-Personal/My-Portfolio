import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id: fieldId } = await params;
    const { data: field } = await client
      .schema("app")
      .from("application_fields")
      .select("id, form_id")
      .eq("id", fieldId)
      .maybeSingle();
    if (!field) return apiResponse(null, request, 404);
    const { data: form } = await client
      .schema("app")
      .from("application_forms")
      .select("application_id")
      .eq("id", field.form_id)
      .maybeSingle();
    const { data: application } = form
      ? await client
          .schema("app")
          .from("applications")
          .select("id")
          .eq("id", form.application_id)
          .eq("owner_id", ownerId)
          .maybeSingle()
      : { data: null };
    if (!application) return apiResponse(null, request, 404);
    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.slice(0, 10000) : "";
    if (!text) return apiResponse({ code: "ANSWER_REQUIRED" }, request, 400);
    const { data, error } = await client
      .schema("app")
      .from("application_answer_versions")
      .insert({
        field_id: fieldId,
        version: 1,
        source: "owner",
        draft_text: text,
        status: "draft",
        content_hash: crypto.randomUUID()
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("ANSWER_DRAFT_CREATE_FAILED");
    return apiResponse(data, request, 201);
  });
}
