import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { resolveReasoningProviders } from "@/lib/server/reasoning-provider";
import { embedWithFallback, resolveEmbeddingProviders } from "@/lib/server/embedding-provider";
import { createServiceSupabaseClient } from "@career-os/database/service";
import { searchLiveJobs } from "@/lib/server/live-job-search";
import { evaluateJobEligibility, type EligibilityProfile } from "@career-os/jobs";

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .slice(0, 20)
    : [];
}

function profileQuery(profile: Record<string, unknown>): string {
  return [
    ...strings(profile.target_titles),
    ...strings(profile.preferred_titles),
    ...strings(profile.required_technologies),
    ...strings(profile.preferred_technologies),
    ...strings(profile.locations),
    "employment experience projects skills achievements impact"
  ].join(" ");
}

export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    if (!body || typeof body.profileId !== "string")
      return apiResponse({ code: "PROFILE_REQUIRED" }, request, 400);
    const profileResult = await client
      .schema("app")
      .from("job_search_profiles")
      .select(
        "target_titles,preferred_titles,locations,regions,excluded_titles,required_technologies,excluded_technologies,preferred_technologies,preferred_companies,excluded_companies,work_arrangements,employment_types"
      )
      .eq("id", body.profileId)
      .eq("owner_id", ownerId)
      .is("archived_at", null)
      .maybeSingle();
    if (profileResult.error) throw profileResult.error;
    if (!profileResult.data) return apiResponse({ code: "PROFILE_NOT_FOUND" }, request, 404);
    try {
      let privateEvidence: { sourceTitle?: string; content: string }[] = [];
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && serviceRoleKey) {
        try {
          const serviceClient = createServiceSupabaseClient(supabaseUrl, serviceRoleKey);
          const embeddingProviders = await resolveEmbeddingProviders(serviceClient, ownerId);
          const query = profileQuery(profileResult.data as Record<string, unknown>);
          const embedded = await embedWithFallback(embeddingProviders, [query]);
          const vector = embedded.vectors[0];
          if (vector) {
            const evidenceResult = await serviceClient.schema("app").rpc(
              "match_owner_private_evidence",
              {
                requested_owner: ownerId,
                requested_embedding: `[${vector.join(",")}]`,
                requested_provider: embedded.provider.provider,
                requested_model: embedded.provider.model,
                requested_model_version: embedded.provider.model_version,
                requested_kinds: ["resume", "cover_letter", "other"],
                requested_limit: 12,
                requested_min_similarity: 0.12
              }
            );
            if (!evidenceResult.error) {
              privateEvidence = (evidenceResult.data ?? [])
                .flatMap((item: unknown) => {
                  if (!item || typeof item !== "object") return [];
                  const row = item as Record<string, unknown>;
                  const content = typeof row.content === "string" ? row.content.trim() : "";
                  if (!content) return [];
                  const sourceTitle =
                    typeof row.source_title === "string" ? row.source_title.trim() : undefined;
                  return [{ content: content.slice(0, 1800), ...(sourceTitle ? { sourceTitle } : {}) }];
                })
                .slice(0, 12);
            }
          }
        } catch {
          // Live discovery remains useful when the optional private-vector layer is not configured.
        }
      }
      const providers = await resolveReasoningProviders(client, ownerId, "job_search");
      const provider = providers[0];
      if (!provider) throw new Error("AI_PROVIDER_NOT_AVAILABLE:job_search");
      const result = await searchLiveJobs(
        provider,
        {
          targetTitles: strings(profileResult.data.target_titles),
          preferredTitles: strings(profileResult.data.preferred_titles),
          locations: strings(profileResult.data.locations),
          requiredTechnologies: strings(profileResult.data.required_technologies),
          preferredTechnologies: strings(profileResult.data.preferred_technologies),
          workArrangements: strings(profileResult.data.work_arrangements),
          employmentTypes: strings(profileResult.data.employment_types),
          privateEvidence
        },
        { allowedDomains: strings(body.allowedDomains) }
      );
      const eligibilityProfile: EligibilityProfile = {
        targetTitles: strings(profileResult.data.target_titles),
        preferredTitles: strings(profileResult.data.preferred_titles),
        excludedTitles: strings(profileResult.data.excluded_titles),
        locations: strings(profileResult.data.locations),
        regions: strings(profileResult.data.regions),
        requiredTechnologies: strings(profileResult.data.required_technologies),
        excludedTechnologies: strings(profileResult.data.excluded_technologies),
        preferredCompanies: strings(profileResult.data.preferred_companies),
        excludedCompanies: strings(profileResult.data.excluded_companies)
      };
      const evaluated = result.jobs.map((job) => ({
        job,
        eligibility: evaluateJobEligibility(job, eligibilityProfile)
      }));
      const jobs = evaluated
        .filter(({ eligibility }) => eligibility.outcome !== "FAIL")
        .map(({ job }) => job);
      return apiResponse(
        {
          jobs,
          domains: result.domains,
          elapsedMs: result.elapsedMs,
          groundedEvidenceCount: privateEvidence.length,
          discoveredCount: result.jobs.length,
          filteredCount: evaluated.filter(({ eligibility }) => eligibility.outcome === "FAIL").length,
          reviewCount: evaluated.filter(({ eligibility }) => eligibility.outcome === "REVIEW").length
        },
        request
      );
    } catch (error) {
      const code = error instanceof Error ? error.message.slice(0, 120) : "LIVE_WEB_SEARCH_FAILED";
      return apiResponse(
        {
          code,
          detail:
            code === "LIVE_WEB_SEARCH_REQUIRES_OPENAI_PROVIDER"
              ? "Live web search currently requires the configured orchestrator to use OpenAI."
              : "Live web search could not be completed."
        },
        request,
        422
      );
    }
  });
}
