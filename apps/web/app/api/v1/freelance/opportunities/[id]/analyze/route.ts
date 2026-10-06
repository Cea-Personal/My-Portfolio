import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { generateFreelanceReasoning, FREELANCE_AGENT_PRIVACY_RULES, hashFreelanceOutput, retrieveFreelanceEvidence } from "@/lib/server/freelance-ai";
import { getFreelanceOpportunity } from "@/lib/server/freelance-opportunities";

type Dict = Record<string, unknown>;
const objectRows = (value: unknown): Dict[] => Array.isArray(value) ? value.filter((item): item is Dict => Boolean(item) && typeof item === "object") : [];
const safeText = (value: unknown, limit = 1000): string => typeof value === "string" ? value.trim().slice(0, limit) : "";
const exactSourceQuote = (quote: unknown, source: string): string | null => {
  const text = safeText(quote, 1200);
  if (!text) return null;
  const normalize = (value: string) => value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
  return normalize(source).includes(normalize(text)) ? text : null;
};
const listText = (value: unknown, limit = 30): string[] => Array.isArray(value) ? value.flatMap((item) => typeof item === "string" && item.trim() ? [item.trim().slice(0, 500)] : []).slice(0, limit) : [];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const opportunity = await getFreelanceOpportunity(client, ownerId, id);
    if (!opportunity?.job) return apiResponse(null, request, 404);
    const description = safeText(opportunity.job.current_description, 100_000);
    if (!description) return apiResponse({ code: "DESCRIPTION_REQUIRED" }, request, 400);

    const evidence = await retrieveFreelanceEvidence(
      client,
      ownerId,
      `${description.slice(0, 5000)}\n${(opportunity.skills ?? []).join(", ")}`
    );
    const evidenceById = new Map(evidence.map((item) => [item.id, item]));
    const analysisGeneration = await generateFreelanceReasoning(
      client,
      ownerId,
      "freelance_opportunity_analysis",
      `${FREELANCE_AGENT_PRIVACY_RULES} Analyze the supplied opportunity. For every observed listing detail, provide an exact sourceQuote copied from opportunity.description. If you cannot provide an exact quote, use null and list that field in unknowns. Inferences also require an exact supporting quote and must be labeled as inferences. For evidenceIds, use only IDs from careerEvidence. Do not infer client ratings, payment status, hiring history, response probability, or the owner's experience from the listing.`,
      {
        opportunity: {
          title: opportunity.job.canonical_title,
          description,
          url: opportunity.job.source_url,
          budgetType: opportunity.budget_type,
          budgetMin: opportunity.budget_min,
          budgetMax: opportunity.budget_max,
          hourlyMin: opportunity.hourly_min,
          hourlyMax: opportunity.hourly_max,
          currency: opportunity.currency,
          duration: opportunity.estimated_duration,
          timezoneRequirements: opportunity.timezone_requirements,
          skills: opportunity.skills,
          client: opportunity.client_id ? { displayName: opportunity.job.canonical_company } : null
        },
        careerEvidence: evidence.map(({ id, sourceTitle, sourceType, content }) => ({ id, sourceTitle, sourceType, content }))
      }
    );
    const generated = analysisGeneration.output;
    const sourceQuote = exactSourceQuote;
    const requirements = objectRows(generated.requirements).flatMap((item) => {
      const quote = sourceQuote(item.sourceQuote, description);
      const text = safeText(item.text, 1000);
      if (!quote || !text) return [];
      return [{ text, priority: ["required", "preferred", "optional"].includes(safeText(item.priority)) ? safeText(item.priority) : "optional", category: safeText(item.category, 80) || "other", sourceQuote: quote }];
    });
    const deliverables = objectRows(generated.deliverables).flatMap((item) => {
      const quote = sourceQuote(item.sourceQuote, description);
      const text = safeText(item.text, 1000);
      return quote && text ? [{ text, sourceQuote: quote }] : [];
    });
    const exactValue = (value: unknown): { value: string | null; sourceQuote: string | null } => {
      const row = value && typeof value === "object" ? value as Dict : {};
      const quote = sourceQuote(row.sourceQuote, description);
      const text = safeText(row.value, 240);
      return quote && text ? { value: text, sourceQuote: quote } : { value: null, sourceQuote: null };
    };
    const inferred = objectRows(generated.inferences).flatMap((item) => {
      const quote = sourceQuote(item.sourceQuote, description);
      const text = safeText(item.text, 700);
      const rationale = safeText(item.rationale, 700);
      return quote && text && rationale ? [{ text, rationale, sourceQuote: quote, classification: "inferred" }] : [];
    });
    const complexity = generated.complexity && typeof generated.complexity === "object" ? generated.complexity as Dict : {};
    const complexityQuote = sourceQuote(complexity.sourceQuote, description);
    const risks = objectRows(generated.risks).flatMap((item) => {
      const quote = sourceQuote(item.sourceQuote, description);
      const text = safeText(item.text, 700);
      const rationale = safeText(item.rationale, 700);
      return quote && text && rationale ? [{ text, rationale, sourceQuote: quote, classification: "inferred" }] : [];
    });

    const observed = {
      title: opportunity.job.canonical_title,
      description,
      url: opportunity.job.source_url ?? null,
      clientName: opportunity.job.canonical_company,
      budgetType: opportunity.budget_type,
      budgetMin: opportunity.budget_min,
      budgetMax: opportunity.budget_max,
      hourlyMin: opportunity.hourly_min,
      hourlyMax: opportunity.hourly_max,
      currency: opportunity.currency,
      duration: opportunity.estimated_duration,
      timezoneRequirements: opportunity.timezone_requirements,
      skills: opportunity.skills,
      listingRequirements: requirements,
      deliverables
    };
    const unknowns = [...new Set([
      ...listText(generated.unknowns),
      ...(!requirements.length ? ["Requirements not verified from exact listing excerpts"] : []),
      ...(!evidence.length ? ["No matching Career Brain evidence was retrieved"] : []),
      ...(!complexityQuote ? ["Complexity is unknown"] : []),
      "Client quality and win probability are unknown without verified client history"
    ])].slice(0, 40);
    const analysisPayload = {
      clientNeed: {
        summary: safeText((generated.clientNeed as Dict | undefined)?.summary, 1200) || "Client need could not be established from the supplied listing.",
        sourceQuote: sourceQuote((generated.clientNeed as Dict | undefined)?.sourceQuote, description)
      },
      requirements,
      deliverables,
      projectType: exactValue(generated.projectType),
      seniority: exactValue(generated.seniority),
      pricingModel: exactValue(generated.pricingModel),
      duration: exactValue(generated.duration),
      timezone: exactValue(generated.timezone),
      industry: exactValue(generated.industry),
      architectureClues: objectRows(generated.architectureClues).flatMap((item) => {
        const quote = sourceQuote(item.sourceQuote, description);
        const text = safeText(item.text, 600);
        return quote && text ? [{ text, sourceQuote: quote }] : [];
      }),
      inferences: inferred,
      complexity: {
        level: complexityQuote ? safeText(complexity.level, 80) || "unknown" : "unknown",
        rationale: complexityQuote ? safeText(complexity.rationale, 700) : "No exact listing excerpt supports a complexity estimate.",
        sourceQuote: complexityQuote,
        classification: complexityQuote ? "inferred" : "unknown"
      },
      risks,
      unknowns
    };

    const evidenceGeneration = requirements.length && evidence.length
      ? await generateFreelanceReasoning(
          client,
          ownerId,
          "freelance_evidence_gap",
          `${FREELANCE_AGENT_PRIVACY_RULES} For every supplied requirement, classify evidence only by specific supplied Career Brain excerpts. Cite exact evidence IDs from careerEvidence. If none directly supports a requirement, mark it missing and say that no evidence was retrieved; do not imply the owner lacks the capability.`,
          { requirements, careerEvidence: evidence.map(({ id, sourceTitle, sourceType, content }) => ({ id, sourceTitle, sourceType, content })) }
        )
      : null;
    const evidenceRows = objectRows(evidenceGeneration?.output.matches).map((item) => {
      const requestedIds = listText(item.evidenceIds, 20).filter((evidenceId) => evidenceById.has(evidenceId));
      const support = ["direct", "transferable", "related", "weak", "contradictory", "missing"].includes(safeText(item.support)) ? safeText(item.support) : "missing";
      const safeSupport = requestedIds.length ? support : "missing";
      const ids = safeSupport === "missing" ? [] : requestedIds;
      return {
        owner_id: ownerId,
        opportunity_id: id,
        requirement_text: safeText(item.requirement, 1000),
        evidence_handles: ids.map((evidenceId) => ({ id: evidenceId, sourceTitle: evidenceById.get(evidenceId)?.sourceTitle, sourceType: evidenceById.get(evidenceId)?.sourceType })),
        support_class: safeSupport,
        confidence: null,
        reason: safeText(item.rationale, 1000) || "No cited support was returned.",
        agent_run_id: evidenceGeneration?.runId ?? analysisGeneration.runId,
        approved_for_proposal: false
      };
    }).filter((item) => item.requirement_text);
    const existingRequirementTexts = new Set(evidenceRows.map((item) => item.requirement_text));
    for (const requirement of requirements) {
      if (existingRequirementTexts.has(requirement.text)) continue;
      evidenceRows.push({
        owner_id: ownerId,
        opportunity_id: id,
        requirement_text: requirement.text,
        evidence_handles: [],
        support_class: "missing",
        confidence: null,
        reason: "No Career Brain evidence match was produced for this requirement.",
        agent_run_id: analysisGeneration.runId,
        approved_for_proposal: false
      });
    }
    const gapRows = objectRows(evidenceGeneration?.output.gaps).flatMap((item) => {
      const requirement = safeText(item.requirement, 1000);
      if (!requirement) return [];
      const match = evidenceRows.find((row) => row.requirement_text === requirement);
      if (match && !["missing", "weak", "contradictory"].includes(match.support_class)) return [];
      return [{
        owner_id: ownerId,
        opportunity_id: id,
        requirement_text: requirement,
        gap_type: match?.support_class === "weak" ? "weak" : match?.support_class === "contradictory" ? "contradictory" : "missing",
        smallest_improvement: safeText(item.smallestImprovement, 1000) || `Review evidence relevant to: ${requirement}`,
        severity: ["low", "medium", "high"].includes(safeText(item.severity)) ? safeText(item.severity) : "medium"
      }];
    });
    for (const row of evidenceRows) {
      if (!["missing", "weak", "contradictory"].includes(row.support_class)) continue;
      if (gapRows.some((gap) => gap.requirement_text === row.requirement_text)) continue;
      gapRows.push({ owner_id: ownerId, opportunity_id: id, requirement_text: row.requirement_text, gap_type: row.support_class === "weak" ? "weak" : row.support_class === "contradictory" ? "contradictory" : "missing", smallest_improvement: `Review or add verified Career Brain evidence relevant to: ${row.requirement_text}`, severity: "medium" });
    }

    const app = client.schema("app");
    const latestVersion = Number(opportunity.analyses?.[0]?.version ?? 0) + 1;
    const insertAnalysis = await app.from("freelance_opportunity_analyses").insert({
      owner_id: ownerId,
      opportunity_id: id,
      version: latestVersion,
      description_id: null,
      client_need: analysisPayload.clientNeed,
      problem_summary: analysisPayload.clientNeed.summary,
      deliverables: analysisPayload.deliverables,
      project_type: analysisPayload.projectType.value,
      seniority: analysisPayload.seniority.value,
      industry: analysisPayload.industry.value,
      pricing_model: analysisPayload.pricingModel.value ?? opportunity.budget_type,
      duration: analysisPayload.duration.value ?? opportunity.estimated_duration,
      timezone: analysisPayload.timezone.value ?? opportunity.timezone_requirements,
      architecture_clues: analysisPayload.architectureClues,
      hidden_requirements: analysisPayload.inferences,
      complexity: analysisPayload.complexity,
      risks: analysisPayload.risks,
      observed,
      inferred: { items: analysisPayload.inferences, verifiedRiskSignals: analysisPayload.risks },
      unknown: analysisPayload.unknowns,
      agent_run_id: analysisGeneration.runId,
      prompt_version: "freelance-opportunity-analysis.v1",
      model_version: analysisGeneration.provider.model_version,
      content_hash: hashFreelanceOutput(analysisPayload)
    }).select("*").single();
    if (insertAnalysis.error || !insertAnalysis.data) throw insertAnalysis.error ?? new Error("FREELANCE_ANALYSIS_FAILED");

    const clearMatches = await app.from("freelance_evidence_matches").delete().eq("owner_id", ownerId).eq("opportunity_id", id);
    if (clearMatches.error) throw clearMatches.error;
    if (evidenceRows.length) {
      const insertMatches = await app.from("freelance_evidence_matches").insert(evidenceRows);
      if (insertMatches.error) throw insertMatches.error;
    }
    const clearGaps = await app.from("freelance_evidence_gaps").delete().eq("owner_id", ownerId).eq("opportunity_id", id);
    if (clearGaps.error) throw clearGaps.error;
    if (gapRows.length) {
      const insertGaps = await app.from("freelance_evidence_gaps").insert(gapRows);
      if (insertGaps.error) throw insertGaps.error;
    }
    return apiResponse({ analysis: insertAnalysis.data, evidenceMatchCount: evidenceRows.length, evidenceGapCount: gapRows.length }, request, 200);
  });
}
