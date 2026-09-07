import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ashbyAdapter } from "./adapters/ashby";
import { customRestAdapter } from "./adapters/custom-rest";
import { greenhouseAdapter } from "./adapters/greenhouse";
import { leverAdapter } from "./adapters/lever";
import { linkedinAuthorizedAdapter } from "./adapters/linkedin-authorized";
import { jobgetherAdapter } from "./adapters/jobgether";
import { remoteOkAdapter } from "./adapters/remoteok";
import { arbeitnowAdapter } from "./adapters/arbeitnow";
import { adzunaAdapter } from "./adapters/adzuna";
import { jsearchAdapter } from "./adapters/jsearch";
import { flybyApisAdapter } from "./adapters/flybyapis";
import { serpApiAdapter } from "./adapters/serpapi";
import { theirStackAdapter } from "./adapters/theirstack";
import { jobsPipeAdapter } from "./adapters/jobspipe";
import { rssAdapter } from "./adapters/rss";
import {
  personioAdapter,
  recruiteeAdapter,
  smartRecruitersAdapter,
  teamtailorAdapter,
  workableAdapter
} from "./adapters/ats";
import { structuredAdapter } from "./adapters/structured";
import { calculateCareerMatch } from "./career-match";
import { calculateOpportunityScore } from "./opportunity-score";
import { evaluateJobEligibility, type EligibilityProfile } from "./eligibility-filter";
import { runSearch, type SearchSourceResult } from "./search-run";
import type { JobSourceAdapter, JobSourceInput } from "./adapters/registry";

const adapters: Record<string, JobSourceAdapter> = {
  ashby: ashbyAdapter,
  "custom-rest": customRestAdapter,
  greenhouse: greenhouseAdapter,
  lever: leverAdapter,
  "linkedin-authorized": linkedinAuthorizedAdapter,
  jobgether: jobgetherAdapter,
  remoteok: remoteOkAdapter,
  arbeitnow: arbeitnowAdapter,
  adzuna: adzunaAdapter,
  jsearch: jsearchAdapter,
  flybyapis: flybyApisAdapter,
  serpapi: serpApiAdapter,
  theirstack: theirStackAdapter,
  jobspipe: jobsPipeAdapter,
  rss: rssAdapter,
  workable: workableAdapter,
  smartrecruiters: smartRecruitersAdapter,
  teamtailor: teamtailorAdapter,
  personio: personioAdapter,
  recruitee: recruiteeAdapter,
  structured: structuredAdapter
};

function failedAdapter(type: string, version: string, reason: string): JobSourceAdapter {
  return {
    type,
    version,
    capabilities: [],
    collect: async () => {
      throw new Error(reason);
    }
  };
}

interface DurableSearchInput {
  client: SupabaseClient;
  ownerId: string;
  runId: string;
  profileId: string;
  operationKey: string;
  sourceIds?: readonly string[];
  /** Scheduled discovery is capped to ten genuinely new jobs per owner/day. */
  dailyNewJobLimit?: number;
}

interface JobRecord {
  id: string;
}

interface SearchProfile {
  target_titles?: unknown;
  seniority_levels?: unknown;
  locations?: unknown;
  work_arrangements?: unknown;
  employment_types?: unknown;
  required_technologies?: unknown;
  industries?: unknown;
  language_requirements?: unknown;
  minimum_salary?: unknown;
  preferred_salary?: unknown;
  salary_currency?: unknown;
  max_job_age_days?: unknown;
  excluded_technologies?: unknown;
  excluded_companies?: unknown;
  scoring_weights?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asNumberRecord(value: unknown): Record<string, number> {
  const record = asRecord(value);
  return Object.fromEntries(
    Object.entries(record).flatMap(([key, item]) =>
      typeof item === "number" && Number.isFinite(item) ? [[key, item]] : []
    )
  );
}

function asStringRecord(value: unknown): Record<string, string> {
  const record = asRecord(value);
  return Object.fromEntries(
    Object.entries(record).flatMap(([key, item]) =>
      typeof item === "string" && item.trim() ? [[key, item.trim()]] : []
    )
  );
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function persistJob(
  client: SupabaseClient,
  ownerId: string,
  sourceId: string,
  job: {
    externalId?: string;
    company: string;
    title: string;
    location?: string;
    canonicalUrl?: string;
    description?: string;
    fingerprint: string;
  },
  sourceProvider: string,
  scoringWeights: Record<string, number>,
  requiredTechnologies: readonly string[],
  searchRunId: string
): Promise<JobRecord> {
  const existingResult = await client
    .schema("app")
    .from("jobs")
    .select("id,status")
    .eq("owner_id", ownerId)
    .eq("normalized_fingerprint", job.fingerprint)
    .limit(1)
    .maybeSingle();
  if (existingResult.error) throw existingResult.error;

  let id: string;
  if (existingResult.data && typeof existingResult.data.id === "string") {
    id = existingResult.data.id;
    const { error } = await client
      .schema("app")
      .from("jobs")
      .update({
        canonical_company: job.company,
        canonical_title: job.title,
        location: job.location ?? null,
        current_description: job.description ?? null,
        ...(job.canonicalUrl ? { source_url: job.canonicalUrl } : {}),
        source_provider: sourceProvider,
        discovered_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("owner_id", ownerId);
    if (error) throw error;
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
        source_url: job.canonicalUrl ?? null,
        source_provider: sourceProvider,
        normalized_fingerprint: job.fingerprint,
        status: "discovered"
      })
      .select("id")
      .single();
    if (inserted.error || !inserted.data || typeof inserted.data.id !== "string")
      throw inserted.error ?? new Error("JOB_PERSIST_FAILED");
    id = inserted.data.id;
    const { error } = await client.schema("app").from("job_status_history").insert({
      job_id: id,
      from_status: null,
      to_status: "discovered",
      reason: "source_discovery"
    });
    if (error) throw error;
  }

  if (job.externalId || job.canonicalUrl) {
    const reference = await client
      .schema("app")
      .from("job_source_references")
      .upsert(
        {
          job_id: id,
          source_id: sourceId,
          external_id: job.externalId ?? job.canonicalUrl,
          canonical_url: job.canonicalUrl ?? null,
          source_payload_hash: hash(JSON.stringify(job)),
          last_seen_at: new Date().toISOString(),
          source_status: "active"
        },
        { onConflict: "source_id,external_id" }
      );
    if (reference.error) throw reference.error;
  }

  if (job.description) {
    const descriptionHash = hash(job.description);
    const latest = await client
      .schema("app")
      .from("job_descriptions")
      .select("version,original_text_hash")
      .eq("job_id", id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest.error) throw latest.error;
    if (latest.data?.original_text_hash !== descriptionHash) {
      const version =
        typeof latest.data?.version === "number" && Number.isInteger(latest.data.version)
          ? latest.data.version + 1
          : 1;
      const insertedDescription = await client.schema("app").from("job_descriptions").insert({
        job_id: id,
        version,
        original_text_hash: descriptionHash,
        normalized_text: job.description,
        source: "job_source"
      });
      if (insertedDescription.error) throw insertedDescription.error;
    }
  }

  const opportunity = calculateOpportunityScore({
    alignment: asNumber(scoringWeights.alignment, 0),
    growth: asNumber(scoringWeights.growth, 0),
    compensation: asNumber(scoringWeights.compensation, 0),
    logistics: asNumber(scoringWeights.logistics, 0)
  });
  const searchableText = `${job.title} ${job.description}`.toLowerCase();
  const requiredTerms = requiredTechnologies;
  const requirements = requiredTerms.map((term, index) => ({
    id: `profile-term-${index}`,
    priority: "required" as const,
    match: searchableText.includes(term.toLowerCase()) ? 1 : 0,
    evidence: [],
    explanation: searchableText.includes(term.toLowerCase())
      ? "Term found in the published job content."
      : "No matching term found in the published job content.",
    outcome: "insufficient_evidence" as const
  }));
  const careerMatch = calculateCareerMatch(requirements);
  const scoreRows = [
    {
      job_id: id,
      score_type: "career_match",
      numeric_score: careerMatch.score,
      factor_values: { profileTerms: requirements.length },
      weights: {},
      calculation_version: "career-match.v1",
      evidence_snapshot: { evidenceIds: careerMatch.evidenceIds, requirements, searchRunId },
      search_run_id: searchRunId
    },
    {
      job_id: id,
      score_type: "opportunity",
      numeric_score: opportunity.score,
      factor_values: opportunity.weights,
      weights: opportunity.weights,
      calculation_version: opportunity.calculationVersion,
      evidence_snapshot: { sourceId, inputs: opportunity.weights, searchRunId },
      search_run_id: searchRunId
    }
  ];
  for (const score of scoreRows) {
    // Each run is an immutable score snapshot; a later run must not overwrite history.
    const existingScore = await client
      .schema("app")
      .from("job_scores")
      .select("id")
      .eq("job_id", id)
      .eq("score_type", score.score_type)
      .eq("calculation_version", score.calculation_version)
      .eq("search_run_id", searchRunId)
      .maybeSingle();
    if (existingScore.error) throw existingScore.error;
    if (!existingScore.data) {
      const insertedScore = await client
        .schema("app")
        .from("job_scores")
        .insert(score as never);
      if (insertedScore.error) throw insertedScore.error;
    }
  }
  return { id };
}

function adapterInput(config: Record<string, unknown>, profile: SearchProfile): JobSourceInput {
  const query: Record<string, string> = {};
  const titles = asStringArray(profile.target_titles);
  const locations = asStringArray(profile.locations);
  const technologies = asStringArray(profile.required_technologies);
  const seniority = asStringArray(profile.seniority_levels);
  const workArrangements = asStringArray(profile.work_arrangements);
  const employmentTypes = asStringArray(profile.employment_types);
  const industries = asStringArray(profile.industries);
  const languages = asStringArray(profile.language_requirements);
  if (titles.length) query.title = titles.join(",");
  if (locations.length) query.location = locations.join(",");
  if (technologies.length) query.technology = technologies.join(",");
  if (seniority.length) query.seniority = seniority.join(",");
  if (workArrangements.length) query.workArrangement = workArrangements.join(",");
  if (employmentTypes.length) query.employmentType = employmentTypes.join(",");
  if (industries.length) query.industry = industries.join(",");
  if (languages.length) query.language = languages.join(",");
  const minimumSalary = asNumber(profile.minimum_salary, Number.NaN);
  const preferredSalary = asNumber(profile.preferred_salary, Number.NaN);
  const salaryCurrency = asString(profile.salary_currency);
  const maxJobAgeDays = asNumber(profile.max_job_age_days, Number.NaN);
  if (Number.isFinite(minimumSalary)) query.minimumSalary = String(minimumSalary);
  if (Number.isFinite(preferredSalary)) query.preferredSalary = String(preferredSalary);
  if (salaryCurrency) query.salaryCurrency = salaryCurrency;
  if (Number.isInteger(maxJobAgeDays) && maxJobAgeDays >= 1)
    query.maxJobAgeDays = String(maxJobAgeDays);
  const lastRunAt = asString(config.last_run_at);
  if (lastRunAt) query.lastRunAt = lastRunAt;
  const endpoint = asString(config.endpoint);
  const fieldMapping = asStringRecord(config.field_mapping);
  const secretRef = asString(config.secret_ref);
  const secret = secretRef ? process.env[secretRef] : undefined;
  const applicationIdRef = asString(config.application_id_ref);
  const applicationId = applicationIdRef ? process.env[applicationIdRef] : undefined;
  return {
    ...(endpoint ? { endpoint } : {}),
    ...(Object.keys(fieldMapping).length ? { fieldMapping } : {}),
    ...(secret ? { headers: { authorization: `Bearer ${secret}` } } : {}),
    ...(applicationId ? { credentials: { applicationId } } : {}),
    ...(Object.keys(query).length ? { query } : {})
  };
}

async function loadSources(
  client: SupabaseClient,
  ownerId: string,
  profileId: string,
  sourceIds: readonly string[] | undefined
): Promise<Array<{ id: string; adapter: JobSourceAdapter; input: JobSourceInput }>> {
  let query = client
    .schema("app")
    .from("job_sources")
    .select("id,adapter_type,adapter_version,enabled,last_run_at")
    .eq("owner_id", ownerId)
    .eq("enabled", true);
  if (sourceIds?.length) query = query.in("id", [...sourceIds]);
  const sourcesResult = await query;
  if (sourcesResult.error) throw sourcesResult.error;
  const sources = (sourcesResult.data ?? []) as unknown as Record<string, unknown>[];
  const profileResult = await client
    .schema("app")
    .from("job_search_profiles")
    .select(
      "target_titles,locations,seniority_levels,work_arrangements,employment_types,required_technologies,industries,language_requirements,minimum_salary,preferred_salary,salary_currency,max_job_age_days,scoring_weights"
    )
    .eq("owner_id", ownerId)
    .eq("id", profileId)
    .limit(1)
    .maybeSingle();
  if (profileResult.error) throw profileResult.error;
  const profile = (profileResult.data ?? {}) as unknown as SearchProfile;
  const result: Array<{ id: string; adapter: JobSourceAdapter; input: JobSourceInput }> = [];
  for (const source of sources) {
    const id = asString(source.id);
    const type = asString(source.adapter_type);
    const version = asString(source.adapter_version);
    if (!id || !type || !version) continue;
    const adapter = adapters[type];
    if (!adapter || adapter.version !== version) {
      result.push({
        id,
        adapter: failedAdapter(type, version, "UNSUPPORTED_SOURCE_ADAPTER"),
        input: {}
      });
      continue;
    }
    const configResult = await client
      .schema("app")
      .from("job_source_configs")
      .select("endpoint,field_mapping,secret_ref,application_id_ref")
      .eq("source_id", id)
      .maybeSingle();
    if (configResult.error) {
      result.push({
        id,
        adapter: failedAdapter(type, version, "SOURCE_CONFIGURATION_UNAVAILABLE"),
        input: {}
      });
      continue;
    }
    result.push({
      id,
      adapter,
      input: adapterInput({ ...asRecord(configResult.data), last_run_at: source.last_run_at }, profile)
    });
  }
  return result;
}

export async function executePersistedSearch(input: DurableSearchInput): Promise<{
  status: "completed" | "partial" | "failed";
  jobs: number;
  sources: SearchSourceResult[];
}> {
  const runMeta = await input.client
    .schema("app")
    .from("job_search_runs")
    .select("trigger_type,logical_date")
    .eq("id", input.runId)
    .eq("owner_id", input.ownerId)
    .maybeSingle();
  if (runMeta.error) throw runMeta.error;
  const scheduledRun = runMeta.data?.trigger_type === "schedule";
  const logicalDate = typeof runMeta.data?.logical_date === "string"
    ? runMeta.data.logical_date
    : new Date().toISOString().slice(0, 10);
  const isWeekday = [1, 2, 3, 4, 5].includes(new Date(`${logicalDate}T00:00:00Z`).getUTCDay());
  const dailyLimit = scheduledRun && isWeekday ? Math.max(1, input.dailyNewJobLimit ?? 10) : Number.POSITIVE_INFINITY;
  let dailyNewJobs = 0;
  let quotaSkipped = 0;
  const existingFingerprintsResult = await input.client
    .schema("app")
    .from("jobs")
    .select("normalized_fingerprint")
    .eq("owner_id", input.ownerId)
    .limit(20_000);
  if (existingFingerprintsResult.error) throw existingFingerprintsResult.error;
  const existingFingerprints = new Set(
    (existingFingerprintsResult.data ?? [])
      .map((row) => row.normalized_fingerprint)
      .filter((value): value is string => typeof value === "string")
  );
  if (scheduledRun && isWeekday) {
    const dayStart = `${logicalDate}T00:00:00.000Z`;
    const nextDate = new Date(`${logicalDate}T00:00:00.000Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    const createdToday = await input.client
      .schema("app")
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", input.ownerId)
      .gte("created_at", dayStart)
      .lt("created_at", nextDate.toISOString());
    if (createdToday.error) throw createdToday.error;
    dailyNewJobs = createdToday.count ?? 0;
  }
  const sourceInputs = await loadSources(
    input.client,
    input.ownerId,
    input.profileId,
    input.sourceIds
  );
  const sourceRows = sourceInputs.map((source) => ({ run_id: input.runId, source_id: source.id }));
  if (sourceRows.length) {
    const initialized = await input.client
      .schema("app")
      .from("job_search_run_sources")
      .upsert(sourceRows, { onConflict: "run_id,source_id" });
    if (initialized.error) throw initialized.error;
  }
  const started = await input.client
    .schema("app")
    .from("job_search_runs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", input.runId)
    .eq("owner_id", input.ownerId);
  if (started.error) throw started.error;
  const result = await runSearch(
    sourceInputs.map((source) => ({ id: source.id, adapter: source.adapter, input: source.input })),
    input.operationKey
  );
  const profileResult = await input.client
    .schema("app")
    .from("job_search_profiles")
    .select(
      "scoring_weights,target_titles,locations,required_technologies,excluded_technologies,excluded_companies"
    )
    .eq("id", input.profileId)
    .eq("owner_id", input.ownerId)
    .maybeSingle();
  if (profileResult.error) throw profileResult.error;
  const scoringWeights = asNumberRecord(profileResult.data?.scoring_weights);
  const requiredTechnologies = asStringArray(profileResult.data?.required_technologies);
  const eligibilityProfile: EligibilityProfile = {
    targetTitles: asStringArray(profileResult.data?.target_titles),
    locations: asStringArray(profileResult.data?.locations),
    requiredTechnologies,
    excludedTechnologies: asStringArray(profileResult.data?.excluded_technologies),
    excludedCompanies: asStringArray(profileResult.data?.excluded_companies)
  };
  const persistedJobIds = new Set<string>();
  let expiredJobCount = 0;
  let filteredJobsCount = 0;
  let reviewJobsCount = 0;
  for (const sourceResult of result.sources) {
    const evaluatedJobs = sourceResult.jobs.map((job) => ({
      job,
      eligibility: evaluateJobEligibility(job, eligibilityProfile)
    }));
    const eligibleJobs = evaluatedJobs.filter(({ eligibility }) => eligibility.outcome !== "FAIL");
    if (evaluatedJobs.length) {
      const rawResult = await input.client
        .schema("app")
        .from("raw_jobs")
        .upsert(
          evaluatedJobs.map(({ job, eligibility }) => ({
            owner_id: input.ownerId,
            source_id: sourceResult.sourceId,
            external_job_id: job.externalId ?? null,
            source_url: job.canonicalUrl ?? null,
            content_hash: hash(JSON.stringify(job)),
            payload: job,
            processing_status: eligibility.outcome === "FAIL" ? "rejected" : "normalized",
            filter_outcome: eligibility.outcome,
            filter_reasons: eligibility.reasons,
            processed_at: new Date().toISOString()
          })),
          { onConflict: "owner_id,source_id,content_hash" }
        );
      if (rawResult.error) throw rawResult.error;
    }
    const failedCount = evaluatedJobs.length - eligibleJobs.length;
    const reviewCount = evaluatedJobs.filter(
      ({ eligibility }) => eligibility.outcome === "REVIEW"
    ).length;
    filteredJobsCount += failedCount;
    reviewJobsCount += reviewCount;
    const completedAt = new Date().toISOString();
    const sourceUpdate = await input.client
      .schema("app")
      .from("job_search_run_sources")
      .update({
        status: sourceResult.status,
        attempts: sourceResult.attempts,
        accepted_count: eligibleJobs.length,
        fetched_count: sourceResult.fetchedCount,
        rejected_count: sourceResult.rejectedCount + failedCount,
        review_count: reviewCount,
        sanitized_error: sourceResult.error ?? null,
        completed_at: completedAt
      })
      .eq("run_id", input.runId)
      .eq("source_id", sourceResult.sourceId);
    if (sourceUpdate.error) throw sourceUpdate.error;
    const healthUpdate = await input.client
      .schema("app")
      .from("job_sources")
      .update({
        health_status: sourceResult.status === "failed" ? "unhealthy" : "healthy",
        last_run_at: completedAt,
        last_success_at: sourceResult.status === "failed" ? undefined : completedAt,
        last_failure_at: sourceResult.status === "failed" ? completedAt : undefined,
        consecutive_failures: sourceResult.status === "failed" ? 1 : 0,
        last_discovered_count: sourceResult.fetchedCount,
        last_accepted_count: eligibleJobs.length
      })
      .eq("id", sourceResult.sourceId)
      .eq("owner_id", input.ownerId);
    if (healthUpdate.error) throw healthUpdate.error;
    const currentSourceJobIds = new Set<string>();
    let persistedSourceCount = 0;
    for (const { job } of eligibleJobs) {
      const isExisting = existingFingerprints.has(job.fingerprint);
      if (!isExisting && dailyNewJobs >= dailyLimit) {
        quotaSkipped += 1;
        continue;
      }
      const persisted = await persistJob(
        input.client,
        input.ownerId,
        sourceResult.sourceId,
        job,
        sourceInputs.find((source) => source.id === sourceResult.sourceId)?.adapter.type ??
          "source_feed",
        scoringWeights,
        requiredTechnologies,
        input.runId
      );
      persistedJobIds.add(persisted.id);
      currentSourceJobIds.add(persisted.id);
      persistedSourceCount += 1;
      if (!isExisting) {
        existingFingerprints.add(job.fingerprint);
        dailyNewJobs += 1;
      }
    }
    if (persistedSourceCount !== eligibleJobs.length) {
      const adjustedRunSource = await input.client
        .schema("app")
        .from("job_search_run_sources")
        .update({ accepted_count: persistedSourceCount })
        .eq("run_id", input.runId)
        .eq("source_id", sourceResult.sourceId);
      if (adjustedRunSource.error) throw adjustedRunSource.error;
      const adjustedSource = await input.client
        .schema("app")
        .from("job_sources")
        .update({ last_accepted_count: persistedSourceCount })
        .eq("id", sourceResult.sourceId)
        .eq("owner_id", input.ownerId);
      if (adjustedSource.error) throw adjustedSource.error;
    }
    // Keep the opportunity list current without deleting history. Only jobs
    // still in the initial discovered state are eligible for reconciliation;
    // shortlisted/applied/interviewed jobs remain owner-controlled records.
    if (sourceResult.status === "completed" && sourceResult.fetchedCount > 0 && quotaSkipped === 0) {
      const sourceRefs = await input.client
        .schema("app")
        .from("job_source_references")
        .select("job_id")
        .eq("source_id", sourceResult.sourceId)
        .eq("source_status", "active");
      if (sourceRefs.error) throw sourceRefs.error;
      const referencedJobIds = (sourceRefs.data ?? [])
        .map((row) => row.job_id)
        .filter((id): id is string => typeof id === "string");
      const staleCandidates = referencedJobIds.filter((id) => !currentSourceJobIds.has(id));
      if (staleCandidates.length) {
        const staleJobs = await input.client
          .schema("app")
          .from("jobs")
          .select("id")
          .eq("owner_id", input.ownerId)
          .eq("status", "discovered")
          .in("id", staleCandidates);
        if (staleJobs.error) throw staleJobs.error;
        const staleIds = (staleJobs.data ?? [])
          .map((row) => row.id)
          .filter((id): id is string => typeof id === "string");
        if (staleIds.length) {
          const expired = await input.client
            .schema("app")
            .from("jobs")
            .update({ status: "expired" })
            .eq("owner_id", input.ownerId)
            .eq("status", "discovered")
            .in("id", staleIds);
          if (expired.error) throw expired.error;
          const history = await input.client.schema("app").from("job_status_history").insert(
            staleIds.map((jobId) => ({
              job_id: jobId,
              from_status: "discovered",
              to_status: "expired",
              actor_id: input.ownerId,
              reason: "source_reconciliation_profile_filter"
            }))
          );
          if (history.error) throw history.error;
          expiredJobCount += staleIds.length;
        }
      }
    }
  }
  const runUpdate = await input.client
    .schema("app")
    .from("job_search_runs")
    .update({
      status: result.status,
      result_counts: {
        discovered: result.jobs.length,
        persisted: persistedJobIds.size,
        filtered: filteredJobsCount,
        review: reviewJobsCount,
        quotaSkipped,
        expired: expiredJobCount,
        failedSources: result.sources.filter((source) => source.status === "failed").length
      },
      finished_at: new Date().toISOString(),
      error_summary:
        result.sources
          .filter((source) => source.error)
          .map((source) => `${source.sourceId}: ${source.error}`)
          .join("; ")
          .slice(0, 1000) || null
    })
    .eq("id", input.runId)
    .eq("owner_id", input.ownerId);
  if (runUpdate.error) throw runUpdate.error;
  return { status: result.status, jobs: persistedJobIds.size, sources: result.sources };
}
