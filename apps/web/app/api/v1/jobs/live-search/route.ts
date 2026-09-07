import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { resolveReasoningProviders } from "@/lib/server/reasoning-provider";
import { embedWithFallback, resolveEmbeddingProviders } from "@/lib/server/embedding-provider";
import { createServiceSupabaseClient } from "@career-os/database/service";
import { searchLiveJobs } from "@/lib/server/live-job-search";
import { evaluateJobEligibility, type EligibilityProfile } from "@career-os/jobs";
import { createHash } from "node:crypto";

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

function fingerprint(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function sourceNameFor(job: { sourceName?: string; canonicalUrl: string }): string {
  if (job.sourceName?.trim()) return job.sourceName.trim().slice(0, 120);
  try {
    return new URL(job.canonicalUrl).hostname.slice(0, 120);
  } catch {
    return "live_web";
  }
}

type PersistedLiveJob = {
  title: string;
  company: string;
  location?: string;
  canonicalUrl: string;
  description?: string;
  postedAt?: string;
  sourceName?: string;
  pipelineJobId?: string;
  discoveryOutcome?: "PASS" | "REVIEW";
};

export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    if (!body || typeof body.profileId !== "string")
      return apiResponse({ code: "PROFILE_REQUIRED" }, request, 400);
    const profileResult = await client
      .schema("app")
      .from("job_search_profiles")
      .select(
        "target_titles,preferred_titles,locations,regions,excluded_titles,required_technologies,excluded_technologies,preferred_technologies,preferred_companies,excluded_companies,work_arrangements,employment_types,enabled"
      )
      .eq("id", body.profileId)
      .eq("owner_id", ownerId)
      .is("archived_at", null)
      .maybeSingle();
    if (profileResult.error) throw profileResult.error;
    if (!profileResult.data) return apiResponse({ code: "PROFILE_NOT_FOUND" }, request, 404);
    if (profileResult.data.enabled !== true)
      return apiResponse(
        { code: "PROFILE_NOT_ENABLED", detail: "Enable the selected search profile first." },
        request,
        409
      );
    const startedAt = new Date().toISOString();
    const runInsert = await client
      .schema("app")
      .from("job_search_runs")
      .insert({
        owner_id: ownerId,
        profile_id: body.profileId,
        trigger_type: "live_web",
        logical_date: startedAt.slice(0, 10),
        status: "running",
        correlation_id: crypto.randomUUID(),
        started_at: startedAt
      })
      .select("id")
      .single();
    if (runInsert.error || !runInsert.data?.id)
      throw runInsert.error ?? new Error("LIVE_SEARCH_RUN_CREATE_FAILED");
    const runId = runInsert.data.id;
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
            const evidenceResult = await serviceClient
              .schema("app")
              .rpc("match_owner_private_evidence", {
                requested_owner: ownerId,
                requested_embedding: `[${vector.join(",")}]`,
                requested_provider: embedded.provider.provider,
                requested_model: embedded.provider.model,
                requested_model_version: embedded.provider.model_version,
                requested_kinds: ["resume", "cover_letter", "other"],
                requested_limit: 12,
                requested_min_similarity: 0.12
              });
            if (!evidenceResult.error) {
              privateEvidence = (evidenceResult.data ?? [])
                .flatMap((item: unknown) => {
                  if (!item || typeof item !== "object") return [];
                  const row = item as Record<string, unknown>;
                  const content = typeof row.content === "string" ? row.content.trim() : "";
                  if (!content) return [];
                  const sourceTitle =
                    typeof row.source_title === "string" ? row.source_title.trim() : undefined;
                  return [
                    { content: content.slice(0, 1800), ...(sourceTitle ? { sourceTitle } : {}) }
                  ];
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
          locations: strings(profileResult.data.locations),
          requiredTechnologies: strings(profileResult.data.required_technologies),
          workArrangements: strings(profileResult.data.work_arrangements),
          employmentTypes: strings(profileResult.data.employment_types),
          privateEvidence
        },
        { allowedDomains: strings(body.allowedDomains) }
      );
      const eligibilityProfile: EligibilityProfile = {
        targetTitles: strings(profileResult.data.target_titles),
        locations: strings(profileResult.data.locations),
        requiredTechnologies: strings(profileResult.data.required_technologies),
        excludedTechnologies: strings(profileResult.data.excluded_technologies),
        excludedCompanies: strings(profileResult.data.excluded_companies)
      };
      const evaluated = result.jobs.map((job) => ({
        job,
        eligibility: evaluateJobEligibility(job, eligibilityProfile)
      }));
      const persistedJobs: PersistedLiveJob[] = [];
      const reviewQueue: PersistedLiveJob[] = [];
      for (const { job, eligibility } of evaluated) {
        const sourceName = sourceNameFor(job);
        const canonicalFingerprint = fingerprint(job.canonicalUrl);
        let pipelineJobId: string | undefined;
        if (eligibility.outcome === "PASS") {
          const byUrl = await client
            .schema("app")
            .from("jobs")
            .select("id,status")
            .eq("owner_id", ownerId)
            .eq("source_url", job.canonicalUrl)
            .limit(1)
            .maybeSingle();
          if (byUrl.error) throw byUrl.error;
          let existing = byUrl.data as { id: string; status: string } | null;
          if (!existing) {
            const byFingerprint = await client
              .schema("app")
              .from("jobs")
              .select("id,status")
              .eq("owner_id", ownerId)
              .eq("normalized_fingerprint", canonicalFingerprint)
              .limit(1)
              .maybeSingle();
            if (byFingerprint.error) throw byFingerprint.error;
            existing = byFingerprint.data as { id: string; status: string } | null;
          }
          if (existing) {
            pipelineJobId = existing.id;
            const update = await client
              .schema("app")
              .from("jobs")
              .update({
                canonical_company: job.company,
                canonical_title: job.title,
                location: job.location ?? null,
                current_description: job.description ?? null,
                source_url: job.canonicalUrl,
                source_provider: "live_web",
                discovery_profile_id: body.profileId,
                discovery_search_run_id: runId,
                discovery_source: sourceName,
                discovery_eligibility: eligibility.outcome,
                discovery_reasons: eligibility.reasons,
                discovery_match_result: {
                  outcome: eligibility.outcome,
                  reasons: eligibility.reasons,
                  searchProfileId: body.profileId,
                  searchRunId: runId
                },
                discovered_at: new Date().toISOString()
              })
              .eq("id", existing.id)
              .eq("owner_id", ownerId);
            if (update.error) throw update.error;
          } else {
            const inserted = await client
              .schema("app")
              .from("jobs")
              .insert({
                owner_id: ownerId,
                canonical_company: job.company,
                canonical_title: job.title,
                location: job.location ?? null,
                current_description: job.description ?? null,
                source_url: job.canonicalUrl,
                source_provider: "live_web",
                normalized_fingerprint: canonicalFingerprint,
                status: "discovered",
                discovery_profile_id: body.profileId,
                discovery_search_run_id: runId,
                discovery_source: sourceName,
                discovery_eligibility: eligibility.outcome,
                discovery_reasons: eligibility.reasons,
                discovery_match_result: {
                  outcome: eligibility.outcome,
                  reasons: eligibility.reasons,
                  searchProfileId: body.profileId,
                  searchRunId: runId
                }
              })
              .select("id")
              .single();
            if (inserted.error || !inserted.data?.id)
              throw inserted.error ?? new Error("LIVE_JOB_PERSIST_FAILED");
            pipelineJobId = inserted.data.id;
            const history = await client.schema("app").from("job_status_history").insert({
              job_id: pipelineJobId,
              from_status: null,
              to_status: "discovered",
              actor_id: ownerId,
              reason: "live_web_discovery"
            });
            if (history.error) throw history.error;
          }
        }
        const event = await client
          .schema("app")
          .from("job_discovery_events")
          .insert({
            owner_id: ownerId,
            profile_id: body.profileId,
            search_run_id: runId,
            job_id: pipelineJobId ?? null,
            source_provider: "live_web",
            source_name: sourceName,
            external_job_id: job.canonicalUrl,
            canonical_url: job.canonicalUrl,
            fingerprint: canonicalFingerprint,
            title: job.title,
            company: job.company,
            location: job.location ?? null,
            description: job.description ?? null,
            outcome: eligibility.outcome,
            reasons: eligibility.reasons,
            match_result: {
              outcome: eligibility.outcome,
              reasons: eligibility.reasons,
              searchProfileId: body.profileId,
              searchRunId: runId
            }
          });
        if (event.error) throw event.error;
        const candidate: PersistedLiveJob = {
          ...job,
          sourceName,
          discoveryOutcome:
            eligibility.outcome === "PASS" ? ("PASS" as const) : ("REVIEW" as const),
          ...(pipelineJobId ? { pipelineJobId } : {})
        };
        if (eligibility.outcome === "REVIEW") reviewQueue.push(candidate);
        if (eligibility.outcome === "PASS") persistedJobs.push(candidate);
      }
      const runUpdate = await client
        .schema("app")
        .from("job_search_runs")
        .update({
          status: "completed",
          result_counts: {
            discovered: result.jobs.length,
            persisted: persistedJobs.length,
            filtered: evaluated.filter(({ eligibility }) => eligibility.outcome === "FAIL").length,
            review: reviewQueue.length
          },
          finished_at: new Date().toISOString()
        })
        .eq("id", runId)
        .eq("owner_id", ownerId);
      if (runUpdate.error) throw runUpdate.error;
      return apiResponse(
        {
          jobs: persistedJobs,
          reviewQueue,
          runId,
          domains: result.domains,
          elapsedMs: result.elapsedMs,
          groundedEvidenceCount: privateEvidence.length,
          discoveredCount: result.jobs.length,
          filteredCount: evaluated.filter(({ eligibility }) => eligibility.outcome === "FAIL")
            .length,
          reviewCount: evaluated.filter(({ eligibility }) => eligibility.outcome === "REVIEW")
            .length
        },
        request
      );
    } catch (error) {
      await client
        .schema("app")
        .from("job_search_runs")
        .update({
          status: "failed",
          error_summary:
            error instanceof Error ? error.message.slice(0, 500) : "LIVE_SEARCH_FAILED",
          finished_at: new Date().toISOString()
        })
        .eq("id", runId)
        .eq("owner_id", ownerId);
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
