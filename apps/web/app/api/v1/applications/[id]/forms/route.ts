import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { createHash } from "node:crypto";
import { generateApplicationAnswers } from "@/lib/server/application-answer-generation";

function paragraphQuestions(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(/\r?\n\s*\r?\n+/)
    .map((question) => question.trim().slice(0, 500))
    .filter(Boolean)
    .slice(0, 100);
}
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
    const explicitFields = Array.isArray(body.fields) ? body.fields.slice(0, 100) : [];
    const manualQuestions = paragraphQuestions(body.questionsText);
    const defaultField = {
      fieldType: typeof body.fieldType === "string" ? body.fieldType : "textarea",
      required: body.required === true,
      sensitive: body.sensitive === true,
      category: typeof body.category === "string" ? body.category : "other",
      charLimit: Number.isInteger(body.charLimit) ? body.charLimit : null,
      wordLimit: Number.isInteger(body.wordLimit) ? body.wordLimit : null
    };
    const candidateFields = [
      ...explicitFields,
      ...manualQuestions.map((label) => ({ label, ...defaultField }))
    ];
    const normalizedLabels = new Set<string>();
    const fields = candidateFields.filter((field: unknown) => {
      if (!field || typeof field !== "object") return false;
      const label = (field as Record<string, unknown>).label;
      if (typeof label !== "string" || !label.trim()) return false;
      const key = label.trim().toLocaleLowerCase();
      if (normalizedLabels.has(key)) return false;
      normalizedLabels.add(key);
      return true;
    });
    if (!fields.length)
      return apiResponse(
        {
          code: "APPLICATION_QUESTIONS_REQUIRED",
          detail: "Add at least one application question, separated by a blank paragraph."
        },
        request,
        400
      );
    const existingForms = await client
      .schema("app")
      .from("application_forms")
      .select("id")
      .eq("application_id", applicationId);
    if (existingForms.error) throw existingForms.error;
    const formIds = (existingForms.data ?? []).map((form) => form.id as string);
    const existingFields = formIds.length
      ? await client.schema("app").from("application_fields").select("label").in("form_id", formIds)
      : { data: [], error: null };
    if (existingFields.error) throw existingFields.error;
    const existingLabels = new Set(
      (existingFields.data ?? []).map((field) => String(field.label).trim().toLocaleLowerCase())
    );
    const newFields = fields.filter(
      (field) =>
        !existingLabels.has(
          String((field as Record<string, unknown>).label)
            .trim()
            .toLocaleLowerCase()
        )
    );
    if (!newFields.length)
      return apiResponse(
        {
          code: "APPLICATION_QUESTIONS_ALREADY_CAPTURED",
          detail: "Those application questions are already captured for this job."
        },
        request,
        409
      );
    const sourceText = JSON.stringify({ sourceUrl: body.sourceUrl, fields: newFields });
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
    const rows = newFields.flatMap((raw: unknown, sequence: number) => {
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
            field.sensitive === true || /gender|race|ethnicity|disability|demographic/i.test(label)
        }
      ];
    });
    const inserted = await client.schema("app").from("application_fields").insert(rows);
    if (inserted.error) throw inserted.error;
    let generation: Awaited<ReturnType<typeof generateApplicationAnswers>> | null = null;
    try {
      generation = await generateApplicationAnswers(client, ownerId, applicationId);
    } catch (error) {
      generation = {
        status: "unavailable",
        generatedCount: 0,
        needsOwnerInput: 0,
        evidenceCount: 0,
        error: error instanceof Error ? error.message.slice(0, 240) : "ANSWER_GENERATION_FAILED"
      };
    }
    return apiResponse(
      {
        form: data,
        generation,
        addedQuestionCount: rows.length,
        duplicateQuestionCount: fields.length - newFields.length
      },
      request,
      201
    );
  });
}
