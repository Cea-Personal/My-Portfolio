import { createHash } from "node:crypto";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { FREELANCE_AGENT_PRIVACY_RULES, generateFreelanceReasoning, retrieveFreelanceEvidence } from "@/lib/server/freelance-ai";
import { getFreelanceOpportunity } from "@/lib/server/freelance-opportunities";

const rows = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
const text = (value: unknown, limit = 2000) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const ids = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const result = await client.schema("app").from("freelance_proposals").select("*, freelance_proposal_versions(*)").eq("owner_id", ownerId).eq("opportunity_id", id).maybeSingle();
    if (result.error) throw result.error;
    return apiResponse({ proposal: result.data }, request, result.data ? 200 : 404);
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const opportunity = await getFreelanceOpportunity(client, ownerId, id);
    if (!opportunity?.job) return apiResponse(null, request, 404);
    if (!opportunity.analyses?.length) return apiResponse({ code: "ANALYSIS_REQUIRED", detail: "Analyze the opportunity before drafting a proposal." }, request, 409);
    const query = `${opportunity.job.current_description ?? ""}\n${(opportunity.skills ?? []).join(", ")}`.slice(0, 6000);
    const evidence = await retrieveFreelanceEvidence(client, ownerId, query);
    const matches = (opportunity.evidenceMatches ?? []).flatMap((match: { requirement_text?: string; evidence_handles?: unknown; support_class?: string }) => [{
      requirement: match.requirement_text ?? "",
      support: match.support_class ?? "missing",
      evidence: rows(match.evidence_handles)
    }]);
    const generated = await generateFreelanceReasoning(
      client,
      ownerId,
      "freelance_proposal",
      `${FREELANCE_AGENT_PRIVACY_RULES} Draft a concise client-specific freelance proposal that directly addresses the stated client problem. Use the supplied evidence and requirement matches only. Return claim-level evidenceIds copied exactly from the supplied Career Brain evidence. Do not include a claim as factual if it has no evidence ID; flag it unsupported. No claim about experience, outcomes, or tools may be inferred from the client's brief. Pricing is not provided here and must not be invented.`,
      {
        opportunity: {
          title: opportunity.job.canonical_title,
          description: opportunity.job.current_description,
          client: opportunity.job.canonical_company,
          budgetType: opportunity.budget_type,
          budgetRange: { min: opportunity.budget_min, max: opportunity.budget_max },
          currency: opportunity.currency
        },
        analysis: opportunity.analyses[0],
        requirementMatches: matches,
        pricing: opportunity.pricing?.[0] ?? null,
        careerEvidence: evidence.map(({ id, sourceTitle, sourceType, content }) => ({ id, sourceTitle, sourceType, content }))
      }
    );
    const evidenceById = new Map(evidence.map((item) => [item.id, item]));
    const claims = rows(generated.output.claims).map((claim) => {
      const claimEvidenceIds = ids(claim.evidenceIds).filter((evidenceId) => evidenceById.has(evidenceId));
      return {
        text: text(claim.text, 1000),
        evidenceIds: claimEvidenceIds,
        support: text(claim.support, 80) || "unknown",
        unsupported: claimEvidenceIds.length === 0
      };
    }).filter((claim) => claim.text);
    const proposalText = text(generated.output.proposalText, 12_000);
    if (!proposalText) return apiResponse({ code: "PROPOSAL_DRAFT_EMPTY" }, request, 502);
    const unsupportedClaims = claims.filter((claim) => claim.unsupported).map((claim) => claim.text);
    const app = client.schema("app");
    const existing = await app.from("freelance_proposals").select("*").eq("owner_id", ownerId).eq("opportunity_id", id).maybeSingle();
    if (existing.error) throw existing.error;
    let proposal = existing.data;
    if (!proposal) {
      const created = await app.from("freelance_proposals").insert({ owner_id: ownerId, opportunity_id: id, crm_status: "QUALIFIED", approval_state: "DRAFT" }).select("*").single();
      if (created.error || !created.data) throw created.error ?? new Error("FREELANCE_PROPOSAL_CREATE_FAILED");
      proposal = created.data;
    }
    const previous = await app.from("freelance_proposal_versions").select("version").eq("owner_id", ownerId).eq("proposal_id", proposal.id).order("version", { ascending: false }).limit(1).maybeSingle();
    if (previous.error) throw previous.error;
    const version = Number(previous.data?.version ?? 0) + 1;
    const inserted = await app.from("freelance_proposal_versions").insert({
      owner_id: ownerId,
      proposal_id: proposal.id,
      version,
      content: { proposalText, clarificationQuestions: ids(generated.output.clarificationQuestions), claims },
      rendered_body: proposalText,
      claim_refs: claims,
      evidence_refs: [...new Set(claims.flatMap((claim) => claim.evidenceIds))],
      unsupported_claims: unsupportedClaims,
      source: "generated",
      agent_run_id: generated.runId,
      prompt_version: "freelance-proposal.v1",
      model_version: generated.provider.model_version,
      owner_edits: {},
      content_hash: createHash("sha256").update(proposalText).digest("hex")
    }).select("*").single();
    if (inserted.error || !inserted.data) throw inserted.error ?? new Error("FREELANCE_PROPOSAL_VERSION_FAILED");
    const update = await app.from("freelance_proposals").update({ current_version_id: inserted.data.id, crm_status: "PROPOSAL_DRAFTED", approval_state: "DRAFT", revision: Number(proposal.revision ?? 0) + 1 }).eq("id", proposal.id).eq("owner_id", ownerId).select("*").single();
    if (update.error || !update.data) throw update.error ?? new Error("FREELANCE_PROPOSAL_UPDATE_FAILED");
    return apiResponse({ proposal: update.data, version: inserted.data, evidenceCount: evidence.length }, request, 201);
  });
}
