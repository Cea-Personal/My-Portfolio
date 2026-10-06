import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeManualOpportunity, upworkProvider, type ManualOpportunityInput } from "@career-os/freelance";

type AppClient = SupabaseClient;

export async function createFreelanceOpportunity(
  client: AppClient,
  ownerId: string,
  input: ManualOpportunityInput
) {
  const normalized = upworkProvider.importManual(input);
  const app = client.schema("app");
  const created = await app.rpc("create_manual_freelance_opportunity", {
    p_input: {
      ...normalized,
      url: normalized.canonicalUrl ?? null,
      descriptionHash: createHash("sha256").update(normalized.description).digest("hex")
    }
  });
  if (created.error) {
    if (created.error.message.includes("DUPLICATE_FREELANCE_OPPORTUNITY")) {
      const duplicate = new Error("DUPLICATE_FREELANCE_OPPORTUNITY");
      duplicate.name = "DUPLICATE_FREELANCE_OPPORTUNITY";
      throw duplicate;
    }
    throw created.error;
  }
  const result = created.data as { opportunity?: Record<string, unknown>; job?: Record<string, unknown> } | null;
  if (!result?.opportunity || !result.job) throw new Error("FREELANCE_OPPORTUNITY_CREATE_FAILED");
  return { ...result.opportunity, job: result.job };
}

export async function listFreelanceOpportunities(client: AppClient, ownerId: string) {
  const app = client.schema("app");
  const opportunities = await app
    .from("freelance_opportunities")
    .select("*")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });
  if (opportunities.error) throw opportunities.error;
  const rows = opportunities.data ?? [];
  const jobIds = rows.map((row) => row.job_id as string);
  const jobs = jobIds.length
    ? await app.from("jobs").select("id,canonical_title,canonical_company,current_description,source_url,status,discovered_at").in("id", jobIds).eq("owner_id", ownerId)
    : { data: [], error: null };
  if (jobs.error) throw jobs.error;
  const byId = new Map((jobs.data ?? []).map((job) => [job.id as string, job]));
  return rows.map((row) => ({ ...row, job: byId.get(row.job_id as string) ?? null }));
}

export async function getFreelanceOpportunity(client: AppClient, ownerId: string, id: string) {
  const app = client.schema("app");
  const opportunity = await app
    .from("freelance_opportunities")
    .select("*")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (opportunity.error) throw opportunity.error;
  if (!opportunity.data) return null;
  const [job, analyses, scores, matches, gaps, pricing, proposal] = await Promise.all([
    app.from("jobs").select("*").eq("id", opportunity.data.job_id).eq("owner_id", ownerId).maybeSingle(),
    app.from("freelance_opportunity_analyses").select("*").eq("opportunity_id", id).eq("owner_id", ownerId).order("version", { ascending: false }),
    app.from("freelance_opportunity_scores").select("*").eq("opportunity_id", id).eq("owner_id", ownerId).order("created_at", { ascending: false }),
    app.from("freelance_evidence_matches").select("*").eq("opportunity_id", id).eq("owner_id", ownerId),
    app.from("freelance_evidence_gaps").select("*").eq("opportunity_id", id).eq("owner_id", ownerId),
    app.from("freelance_pricing_recommendations").select("*").eq("opportunity_id", id).eq("owner_id", ownerId).order("created_at", { ascending: false }),
    app.from("freelance_proposals").select("*, freelance_proposal_versions(*)").eq("opportunity_id", id).eq("owner_id", ownerId).maybeSingle()
  ]);
  for (const result of [job, analyses, scores, matches, gaps, pricing, proposal]) if (result.error) throw result.error;
  return {
    ...opportunity.data,
    job: job.data,
    analyses: analyses.data ?? [],
    scores: scores.data ?? [],
    evidenceMatches: matches.data ?? [],
    evidenceGaps: gaps.data ?? [],
    pricing: pricing.data ?? [],
    proposal: proposal.data ?? null
  };
}

export { normalizeManualOpportunity };
