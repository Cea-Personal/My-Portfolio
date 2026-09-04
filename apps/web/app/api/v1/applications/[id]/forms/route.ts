import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { createHash } from "node:crypto";
export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const application = await client
      .schema("app")
      .from("applications")
      .select("id")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (!application.data) return apiResponse([], request, 404);
    const { data, error } = await client
      .schema("app")
      .from("application_forms")
      .select("*, application_fields(*, application_answer_versions(*))")
      .eq("application_id", id)
      .order("captured_at", { ascending: false });
    if (error) throw error;
    return apiResponse(data ?? [], request);
  });
}
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
    const fields = Array.isArray(body.fields) ? body.fields.slice(0, 100) : [];
    const sourceText = JSON.stringify({ sourceUrl: body.sourceUrl, fields });
    const { data, error } = await client
      .schema("app")
      .from("application_forms")
      .insert({
        application_id: applicationId,
        source_url: typeof body.sourceUrl === "string" ? body.sourceUrl : null,
        access_method: typeof body.accessMethod === "string" ? body.accessMethod : "manual",
        schema_version: "application-form.v1",
        source_hash: createHash("sha256").update(sourceText).digest("hex")
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("FORM_CREATE_FAILED");
    if (fields.length) {
      const rows = fields.flatMap((raw: unknown, sequence: number) => {
        if (!raw || typeof raw !== "object") return [];
        const field = raw as Record<string, unknown>;
        const label = typeof field.label === "string" ? field.label.trim().slice(0, 500) : "";
        if (!label) return [];
        return [
          {
            form_id: data.id,
            sequence,
            label,
            field_type:
              typeof field.fieldType === "string" ? field.fieldType.slice(0, 40) : "textarea",
            required: field.required === true,
            choices: Array.isArray(field.choices) ? field.choices.slice(0, 100) : null,
            char_limit: Number.isInteger(field.charLimit) ? field.charLimit : null,
            word_limit: Number.isInteger(field.wordLimit) ? field.wordLimit : null,
            category: typeof field.category === "string" ? field.category.slice(0, 80) : "other",
            sensitive:
              field.sensitive === true ||
              /gender|race|ethnicity|disability|demographic/i.test(label)
          }
        ];
      });
      const inserted = await client.schema("app").from("application_fields").insert(rows);
      if (inserted.error) throw inserted.error;
    }
    return apiResponse(data, request, 201);
  });
}
