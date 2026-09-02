import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data: runs, error: runError } = await client
      .schema("app")
      .from("ingestion_runs")
      .select("id")
      .eq("owner_id", ownerId);
    if (runError) throw runError;
    const runIds = (runs ?? []).map((run) => run.id).filter(Boolean);
    if (!runIds.length) return apiResponse([], request);
    const { data: items, error: itemError } = await client
      .schema("app")
      .from("ingestion_items")
      .select("id")
      .in("run_id", runIds);
    if (itemError) throw itemError;
    const itemIds = (items ?? []).map((item) => item.id).filter(Boolean);
    if (!itemIds.length) return apiResponse([], request);
    const { data, error } = await client
      .schema("app")
      .from("extracted_facts")
      .select("*")
      .in("ingestion_item_id", itemIds)
      .eq("review_status", "candidate");
    if (error) throw error;
    return apiResponse(data ?? [], request);
  });
}

export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    const extractedFactId = typeof body.extractedFactId === "string" ? body.extractedFactId : null;
    const decision = typeof body.decision === "string" ? body.decision : null;
    if (!extractedFactId || !decision || !["approve", "edit", "reject", "defer"].includes(decision))
      return apiResponse({ code: "INVALID_FACT_REVIEW" }, request, 400);

    const { data: extracted, error } = await client
      .schema("app")
      .from("extracted_facts")
      .select("*,ingestion_items!inner(run_id,ingestion_runs!inner(owner_id))")
      .eq("id", extractedFactId)
      .eq("ingestion_items.ingestion_runs.owner_id", ownerId)
      .maybeSingle();
    if (error) throw error;
    if (!extracted) return apiResponse({ code: "EXTRACTED_FACT_NOT_FOUND" }, request, 404);

    let versionId: string | null = null;
    if (decision === "approve" || decision === "edit") {
      const statement =
        decision === "edit" && typeof body.statement === "string"
          ? body.statement.trim().slice(0, 10_000)
          : extracted.statement;
      if (!statement) return apiResponse({ code: "STATEMENT_REQUIRED" }, request, 400);
      const subject =
        extracted.subject_candidate && typeof extracted.subject_candidate === "object"
          ? (extracted.subject_candidate as Record<string, unknown>)
          : {};
      const { data: fact, error: factError } = await client
        .schema("app")
        .from("career_facts")
        .insert({
          owner_id: ownerId,
          fact_type: typeof subject.factType === "string" ? subject.factType : "responsibility",
          subject_type: typeof body.subjectType === "string" ? body.subjectType : "career",
          subject_id: typeof body.subjectId === "string" ? body.subjectId : crypto.randomUUID(),
          trust_level: "ai_extracted_reviewed",
          review_status: decision === "edit" ? "edited_approved" : "approved",
          visibility: body.visibility === "public" ? "public" : "private",
          verified_by_owner: true
        })
        .select("id")
        .single();
      if (factError || !fact) throw factError ?? new Error("CAREER_FACT_CREATE_FAILED");
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(statement));
      const contentHash = Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      const { data: version, error: versionError } = await client
        .schema("app")
        .from("career_fact_versions")
        .insert({
          fact_id: fact.id,
          version: 1,
          statement,
          structured_value:
            body.structuredValue && typeof body.structuredValue === "object"
              ? body.structuredValue
              : subject,
          source_type: "document_extraction",
          extractor_version: extracted.model_version,
          confidence: extracted.confidence,
          editor_actor: "owner",
          edit_reason: typeof body.reason === "string" ? body.reason.slice(0, 1000) : null,
          content_hash: contentHash
        })
        .select("id")
        .single();
      if (versionError || !version) throw versionError ?? new Error("FACT_VERSION_CREATE_FAILED");
      versionId = version.id;
      const { error: linkError } = await client
        .schema("app")
        .from("career_facts")
        .update({ current_version_id: version.id })
        .eq("id", fact.id)
        .eq("owner_id", ownerId);
      if (linkError) throw linkError;
    }

    const { data: review, error: reviewError } = await client
      .schema("app")
      .from("fact_reviews")
      .insert({
        extracted_fact_id: extractedFactId,
        reviewer_id: ownerId,
        decision,
        edited_fact_version_id: versionId,
        reason: typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : null
      })
      .select("*")
      .single();
    if (reviewError || !review) throw reviewError ?? new Error("FACT_REVIEW_CREATE_FAILED");
    const reviewStatus =
      decision === "approve"
        ? "approved"
        : decision === "edit"
          ? "edited_approved"
          : decision === "reject"
            ? "rejected"
            : "deferred";
    const { error: updateError } = await client
      .schema("app")
      .from("extracted_facts")
      .update({ review_status: reviewStatus })
      .eq("id", extractedFactId);
    if (updateError) throw updateError;
    return apiResponse({ review, reviewStatus, careerFactVersionId: versionId }, request, 201);
  });
}
