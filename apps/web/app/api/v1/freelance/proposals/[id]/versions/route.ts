import { createHash } from "node:crypto";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

const rows = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
const asText = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 12_000) : "";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const bodyValue = await request.json().catch(() => ({}));
    const body = bodyValue && typeof bodyValue === "object" ? bodyValue as Record<string, unknown> : {};
    const proposalQuery = await client.schema("app").from("freelance_proposals").select("*").eq("id", id).eq("owner_id", ownerId).maybeSingle();
    if (proposalQuery.error) throw proposalQuery.error;
    if (!proposalQuery.data) return apiResponse(null, request, 404);
    const proposal = proposalQuery.data;
    const proposalText = asText(body.proposalText);
    if (!proposalText) return apiResponse({ code: "PROPOSAL_TEXT_REQUIRED" }, request, 400);
    const matches = await client.schema("app").from("freelance_evidence_matches").select("evidence_handles,support_class").eq("owner_id", ownerId).eq("opportunity_id", proposal.opportunity_id);
    if (matches.error) throw matches.error;
    const allowedEvidence = new Set(matches.data
      .filter((match) => ["direct", "transferable", "related"].includes(match.support_class))
      .flatMap((match) => rows(match.evidence_handles).flatMap((handle) => typeof handle.id === "string" ? [handle.id] : [])));
    const claims = rows(body.claims).map((claim) => {
      const claimText = asText(claim.text);
      const evidenceIds = Array.isArray(claim.evidenceIds)
        ? claim.evidenceIds.filter((value): value is string => typeof value === "string" && allowedEvidence.has(value))
        : [];
      return { text: claimText, evidenceIds, unsupported: evidenceIds.length === 0 };
    }).filter((claim) => claim.text);
    if (body.claims !== undefined && claims.length !== rows(body.claims).length)
      return apiResponse({ code: "INVALID_PROPOSAL_CLAIMS", detail: "Each claim must include text and only verified evidence references." }, request, 400);
    const unsupported = claims.filter((claim) => claim.unsupported).map((claim) => claim.text);
    if (body.markReadyForReview === true && !claims.length)
      return apiResponse({ code: "PROPOSAL_CLAIMS_REQUIRED", detail: "Add at least one evidence-backed claim before review." }, request, 409);
    if (body.markReadyForReview === true && unsupported.length)
      return apiResponse({ code: "UNSUPPORTED_CLAIMS_REMAIN", detail: "Remove or substantiate every claim before marking the proposal ready for review." }, request, 409);
    const versionQuery = await client.schema("app").from("freelance_proposal_versions").select("version").eq("owner_id", ownerId).eq("proposal_id", id).order("version", { ascending: false }).limit(1).maybeSingle();
    if (versionQuery.error) throw versionQuery.error;
    const version = Number(versionQuery.data?.version ?? 0) + 1;
    const readyForReview = body.markReadyForReview === true;
    const now = new Date().toISOString();
    const inserted = await client.schema("app").from("freelance_proposal_versions").insert({
      owner_id: ownerId,
      proposal_id: id,
      version,
      content: { proposalText, claims },
      rendered_body: proposalText,
      claim_refs: claims,
      evidence_refs: [...new Set(claims.flatMap((claim) => claim.evidenceIds))],
      unsupported_claims: unsupported,
      source: "owner_edited",
      prompt_version: "owner-edit.v1",
      model_version: "owner",
      owner_edits: { reviewedByOwner: readyForReview, reviewedAt: readyForReview ? now : null },
      content_hash: createHash("sha256").update(proposalText).digest("hex"),
      reviewed_at: readyForReview ? now : null
    }).select("*").single();
    if (inserted.error || !inserted.data) throw inserted.error ?? new Error("FREELANCE_PROPOSAL_VERSION_FAILED");
    const update = await client.schema("app").from("freelance_proposals").update({
      current_version_id: inserted.data.id,
      approval_state: readyForReview ? "READY_FOR_REVIEW" : "DRAFT",
      crm_status: readyForReview ? "READY_FOR_REVIEW" : "PROPOSAL_DRAFTED",
      revision: Number(proposal.revision ?? 0) + 1
    }).eq("id", id).eq("owner_id", ownerId).select("*").single();
    if (update.error || !update.data) throw update.error ?? new Error("FREELANCE_PROPOSAL_UPDATE_FAILED");
    const history = await client.schema("app").from("freelance_proposal_status_history").insert({
      owner_id: ownerId,
      proposal_id: id,
      from_status: proposal.crm_status,
      to_status: update.data.crm_status,
      from_approval_state: proposal.approval_state,
      to_approval_state: update.data.approval_state,
      actor_id: ownerId,
      reason: readyForReview ? "owner_reviewed_current_version" : "owner_edited_proposal"
    });
    if (history.error) throw history.error;
    return apiResponse({ proposal: update.data, version: inserted.data, unsupportedClaims: unsupported }, request, 201);
  });
}
