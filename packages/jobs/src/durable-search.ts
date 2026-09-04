import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ashbyAdapter } from "./adapters/ashby";
import { customRestAdapter } from "./adapters/custom-rest";
import { greenhouseAdapter } from "./adapters/greenhouse";
import { leverAdapter } from "./adapters/lever";
import { linkedinAuthorizedAdapter } from "./adapters/linkedin-authorized";
import { rssAdapter } from "./adapters/rss";
import { calculateCareerMatch } from "./career-match";
import { calculateOpportunityScore } from "./opportunity-score";
import { runSearch, type SearchSourceResult } from "./search-run";
import type { JobSourceAdapter, JobSourceInput } from "./adapters/registry";

const adapters: Record<string, JobSourceAdapter> = {
  ashby: ashbyAdapter,
  "custom-rest": customRestAdapter,
  greenhouse: greenhouseAdapter,
  lever: leverAdapter,
  "linkedin-authorized": linkedinAuthorizedAdapter,
  rss: rssAdapter
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
}

interface JobRecord {
  id: string;
}

interface SearchProfile {
  target_titles?: unknown;
  locations?: unknown;
  required_technologies?: unknown;
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
  const scoreRows = [
    {
      job_id: id,
      score_type: "career_match",
      numeric_score: calculateCareerMatch([]).score,
      factor_values: { evidence: 0 },
      weights: {},
      calculation_version: "career-match.v1",
      evidence_snapshot: { evidenceIds: [], searchRunId },
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
  if (titles.length) query.title = titles.join(",");
  if (locations.length) query.location = locations.join(",");
  if (technologies.length) query.technology = technologies.join(",");
  const endpoint = asString(config.endpoint);
  const fieldMapping = asStringRecord(config.field_mapping);
  const secretRef = asString(config.secret_ref);
  const secret = secretRef ? process.env[secretRef] : undefined;
  return {
    ...(endpoint ? { endpoint } : {}),
    ...(Object.keys(fieldMapping).length ? { fieldMapping } : {}),
    ...(secret ? { headers: { authorization: `Bearer ${secret}` } } : {}),
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
    .select("id,adapter_type,adapter_version,enabled")
    .eq("owner_id", ownerId)
    .eq("enabled", true);
  if (sourceIds?.length) query = query.in("id", [...sourceIds]);
  const sourcesResult = await query;
  if (sourcesResult.error) throw sourcesResult.error;
  const sources = (sourcesResult.data ?? []) as unknown as Record<string, unknown>[];
  const profileResult = await client
    .schema("app")
    .from("job_search_profiles")
    .select("target_titles,locations,required_technologies,scoring_weights")
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
      .select("endpoint,field_mapping,secret_ref")
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
    result.push({ id, adapter, input: adapterInput(asRecord(configResult.data), profile) });
  }
  return result;
}

export async function executePersistedSearch(input: DurableSearchInput): Promise<{
  status: "completed" | "partial" | "failed";
  jobs: number;
  sources: SearchSourceResult[];
}> {
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
    .select("scoring_weights")
    .eq("id", input.profileId)
    .eq("owner_id", input.ownerId)
    .maybeSingle();
  if (profileResult.error) throw profileResult.error;
  const scoringWeights = asNumberRecord(profileResult.data?.scoring_weights);
  const persistedJobIds = new Set<string>();
  for (const sourceResult of result.sources) {
    const sourceUpdate = await input.client
      .schema("app")
      .from("job_search_run_sources")
      .update({
        status: sourceResult.status,
        attempts: sourceResult.attempts,
        accepted_count: sourceResult.jobs.length,
        fetched_count: sourceResult.fetchedCount,
        rejected_count: sourceResult.rejectedCount,
        sanitized_error: sourceResult.error ?? null
      })
      .eq("run_id", input.runId)
      .eq("source_id", sourceResult.sourceId);
    if (sourceUpdate.error) throw sourceUpdate.error;
    for (const job of sourceResult.jobs) {
      const persisted = await persistJob(
        input.client,
        input.ownerId,
        sourceResult.sourceId,
        job,
        sourceInputs.find((source) => source.id === sourceResult.sourceId)?.adapter.type ??
          "source_feed",
        scoringWeights,
        input.runId
      );
      persistedJobIds.add(persisted.id);
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
