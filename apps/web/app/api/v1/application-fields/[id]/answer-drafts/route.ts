import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { createHash } from "node:crypto";
export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const owned = await client
      .schema("app")
      .from("application_fields")
      .select("id,application_forms!inner(applications!inner(owner_id))")
      .eq("id", id)
      .eq("application_forms.applications.owner_id", ownerId)
      .maybeSingle();
    if (!owned.data) return apiResponse([], request, 404);
    const { data, error } = await client
      .schema("app")
      .from("application_answer_versions")
      .select("*")
      .eq("field_id", id)
      .order("version", { ascending: false });
    if (error) throw error;
    return apiResponse(data ?? [], request);
  });
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id: fieldId } = await params;
    const { data: field } = await client
      .schema("app")
      .from("application_fields")
      .select("id,form_id,label,required,char_limit,word_limit,sensitive")
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
    if (field.required && !text.trim())
      return apiResponse({ code: "ANSWER_REQUIRED" }, request, 400);
    if (field.sensitive && body.explicitOwnerInput !== true)
      return apiResponse({ code: "SENSITIVE_OWNER_INPUT_REQUIRED" }, request, 400);
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    if (
      (field.char_limit && text.length > field.char_limit) ||
      (field.word_limit && wordCount > field.word_limit)
    )
      return apiResponse({ code: "ANSWER_LIMIT_EXCEEDED" }, request, 400);
    const previous = await client
      .schema("app")
      .from("application_answer_versions")
      .select("version")
      .eq("field_id", fieldId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (previous.error) throw previous.error;
    const version = typeof previous.data?.version === "number" ? previous.data.version + 1 : 1;
    const approved = body.approved === true;
    const { data, error } = await client
      .schema("app")
      .from("application_answer_versions")
      .insert({
        field_id: fieldId,
        version,
        source: body.source === "profile" ? "profile" : "owner",
        original_question: field.label,
        draft_text: text,
        final_text: approved ? text : null,
        evidence_ids: Array.isArray(body.evidenceIds) ? body.evidenceIds.slice(0, 100) : [],
        generation_context:
          body.generationContext && typeof body.generationContext === "object"
            ? body.generationContext
            : {},
        owner_edits: body.ownerEdits && typeof body.ownerEdits === "object" ? body.ownerEdits : {},
        limit_result: {
          characters: text.length,
          words: wordCount,
          charLimit: field.char_limit,
          wordLimit: field.word_limit
        },
        status: approved ? "approved" : "draft",
        owner_approved_at: approved ? new Date().toISOString() : null,
        content_hash: createHash("sha256").update(text).digest("hex")
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("ANSWER_DRAFT_CREATE_FAILED");
    return apiResponse(data, request, 201);
  });
}
