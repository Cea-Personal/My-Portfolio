import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCareerFactType, normalizeStructuredValue } from "@/lib/career-fact-taxonomy";

type ReviewDecision = "approve" | "edit" | "reject" | "defer";

async function reviewOne(
  client: SupabaseClient,
  ownerId: string,
  extractedFactId: string,
  decision: ReviewDecision,
  body: Record<string, unknown>
) {
  const { data: extracted, error } = await client
    .schema("app")
    .from("extracted_facts")
    .select("*,ingestion_items!inner(run_id,ingestion_runs!inner(owner_id))")
    .eq("id", extractedFactId)
    .eq("ingestion_items.ingestion_runs.owner_id", ownerId)
    .eq("review_status", "candidate")
    .maybeSingle();
  if (error) throw error;
  if (!extracted) return { id: extractedFactId, status: "not_found" as const };

  let versionId: string | null = null;
  if (decision === "approve" || decision === "edit") {
    const statement =
      decision === "edit" && typeof body.statement === "string"
        ? body.statement.trim().slice(0, 10_000)
        : extracted.statement;
    if (!statement) return { id: extractedFactId, status: "statement_required" as const };
    const subject =
      extracted.subject_candidate && typeof extracted.subject_candidate === "object"
        ? (extracted.subject_candidate as Record<string, unknown>)
        : {};
    const factType = normalizeCareerFactType(subject.factType);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(statement));
    const contentHash = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const { data: existingVersion, error: existingError } = await client
      .schema("app")
      .from("career_fact_versions")
      .select("id,fact_id,career_facts!career_fact_versions_fact_id_fkey!inner(owner_id)")
      .eq("content_hash", contentHash)
      .eq("career_facts.owner_id", ownerId)
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existingVersion) {
      versionId = existingVersion.id as string;
    } else {
      const { data: fact, error: factError } = await client
        .schema("app")
        .from("career_facts")
        .insert({
          owner_id: ownerId,
          fact_type: factType,
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
      const { data: version, error: versionError } = await client
        .schema("app")
        .from("career_fact_versions")
        .insert({
          fact_id: fact.id,
          version: 1,
          statement,
          structured_value: normalizeStructuredValue(
            factType,
            body.structuredValue && typeof body.structuredValue === "object"
              ? { ...subject, ...(body.structuredValue as Record<string, unknown>) }
              : subject
          ),
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
    .select("id")
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
  return { id: extractedFactId, status: reviewStatus, careerFactVersionId: versionId };
}
export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data, error } = await client
      .schema("app")
      .from("extracted_facts")
      .select("*,ingestion_items!inner(ingestion_runs!inner(owner_id))")
      .eq("ingestion_items.ingestion_runs.owner_id", ownerId)
      .eq("review_status", "candidate")
      .order("id", { ascending: false })
      .limit(1_000);
    if (error) throw error;
    return apiResponse(data ?? [], request);
  });
}

export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    const extractedFactIds = Array.isArray(body.extractedFactIds)
      ? body.extractedFactIds.filter((id: unknown): id is string => typeof id === "string")
      : typeof body.extractedFactId === "string"
        ? [body.extractedFactId]
        : [];
    const decision = typeof body.decision === "string" ? body.decision : null;
    if (
      !extractedFactIds.length ||
      extractedFactIds.length > 100 ||
      !decision ||
      !["approve", "edit", "reject", "defer"].includes(decision) ||
      (decision === "edit" && extractedFactIds.length !== 1)
    )
      return apiResponse({ code: "INVALID_FACT_REVIEW" }, request, 400);
    const results = [];
    for (const id of extractedFactIds) {
      results.push(await reviewOne(client, ownerId, id, decision as ReviewDecision, body));
    }
    return apiResponse({ results, reviewed: results.length }, request, 201);
  });
}
