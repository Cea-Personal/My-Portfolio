import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { embedWithFallback, resolveEmbeddingProviders } from "./embedding-provider";
import { generateReasoningJson, resolveReasoningProviders } from "./reasoning-provider";
import { rerankCandidates } from "./reranker-provider";

export interface CareerBrainItem {
  id: string;
  [key: string]: unknown;
}

export interface CareerBrainContent {
  cvSummary: string;
  portfolioSummary: string;
  about: string;
  experiences: CareerBrainItem[];
  projects: CareerBrainItem[];
  education: CareerBrainItem[];
  certifications: CareerBrainItem[];
  technicalSkills: CareerBrainItem[];
}

// Increment when the synthesis contract or prompt changes so an existing
// snapshot cannot silently keep the older, summary-only shape.
const CAREER_BRAIN_SYNTHESIS_VERSION = "career-brain.v3.human-voice";

// Career Brain is a bounded synthesis job, not a health probe. Native Codex
// subagents can need more time to reconcile multiple documents and produce the
// complete structured profile requested by the schema.
const CAREER_BRAIN_TIMEOUT_MS = 120_000;
const CAREER_BRAIN_RAG_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CAREER_BRAIN_RAG_CACHE_VERSION = "rag.v1";

const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value.trim().slice(0, 10_000) : fallback;
const strings = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 100)
    : [];

function uniqueStrings(value: unknown, limit = 100): string[] {
  const seen = new Set<string>();
  return strings(value)
    .filter((entry) => {
      const key = entry
        .toLocaleLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

/** Keep a role useful for a CV without letting repeated source CV bullets take over. */
function selectRolePoints(item: Record<string, unknown>) {
  const buckets = [
    { key: "achievements", values: uniqueStrings(item.achievements, 8) },
    { key: "impact", values: uniqueStrings(item.impact, 8) },
    { key: "responsibilities", values: uniqueStrings(item.responsibilities, 8) }
  ] as const;
  const selected = new Set<string>();
  const selectedByKey = new Map<string, string[]>();
  const add = (key: string, value: string) => {
    const normalized = value
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    if (selected.size >= 7 || selected.has(normalized)) return;
    selected.add(normalized);
    selectedByKey.get(key)?.push(value);
  };
  for (const bucket of buckets) {
    selectedByKey.set(bucket.key, []);
  }
  // Keep a representative responsibility, achievement, and impact when each
  // category is available before filling the remaining slots by relevance.
  for (const bucket of buckets) {
    const first = bucket.values[0];
    if (first) add(bucket.key, first);
  }
  for (const bucket of buckets) {
    for (const value of bucket.values) {
      add(bucket.key, value);
    }
  }
  return {
    responsibilities: selectedByKey.get("responsibilities") ?? [],
    achievements: selectedByKey.get("achievements") ?? [],
    impact: selectedByKey.get("impact") ?? []
  };
}
const records = (value: unknown) =>
  Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> => Boolean(item) && typeof item === "object"
      )
    : [];

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

function anonymizePrivateEmployer(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/\bthames\s+water\b/gi, "a utilities organisation");
  }
  if (Array.isArray(value)) return value.map((item) => anonymizePrivateEmployer(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, anonymizePrivateEmployer(item)])
    );
  }
  return value;
}

const firstRecord = (value: unknown) => records(Array.isArray(value) ? value : [value])[0] ?? null;

function boundedRecords<T>(items: T[], maxItems: number, maxCharacters: number): T[] {
  const bounded: T[] = [];
  let characters = 0;
  for (const item of items) {
    if (bounded.length >= maxItems) break;
    const size = JSON.stringify(item).length;
    if (characters + size > maxCharacters) break;
    bounded.push(item);
    characters += size;
  }
  return bounded;
}

type RetrievedEvidence = {
  id: string;
  source?: string;
  section?: unknown;
  content: string;
  similarity?: unknown;
};

type RetrievalCache = {
  cacheKey: string;
  queryEmbeddings: number[][];
  evidence: RetrievedEvidence[];
  sourceHash: string | null;
  expiresAt: number;
};

function retrievalCacheKey(
  ownerId: string,
  provider: { provider: string; model: string; model_version: string | null | undefined },
  queries: string[],
  serviceMode: boolean
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: CAREER_BRAIN_RAG_CACHE_VERSION,
        ownerId,
        provider: provider.provider,
        model: provider.model,
        modelVersion: provider.model_version ?? "",
        queries,
        serviceMode
      })
    )
    .digest("hex");
}

function evidenceFromRows(value: unknown): RetrievedEvidence[] {
  return records(value).flatMap((item) => {
    const id = text(item.chunk_id || item.id);
    const content = text(item.content).slice(0, 2500);
    if (!id || !content) return [];
    return [
      {
        id,
        source: text(item.source_title || item.source),
        section: item.section_path ?? item.section,
        content,
        similarity: item.similarity
      }
    ];
  });
}

function mergeEvidence(...sets: RetrievedEvidence[][]): RetrievedEvidence[] {
  const merged = new Map<string, RetrievedEvidence>();
  for (const set of sets) {
    for (const item of set) {
      if (!merged.has(item.id)) merged.set(item.id, item);
    }
  }
  return [...merged.values()].slice(0, 60);
}

async function readRetrievalCache(
  client: SupabaseClient,
  ownerId: string,
  cacheKey: string
): Promise<RetrievalCache | null> {
  try {
    const result = await client
      .schema("app")
      .from("career_brain_retrieval_cache")
      .select("cache_key,query_embeddings,evidence,source_hash,expires_at")
      .eq("owner_id", ownerId)
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (result.error || !result.data) return null;
    const embeddings = Array.isArray(result.data.query_embeddings)
      ? result.data.query_embeddings.filter(
          (vector: unknown): vector is number[] =>
            Array.isArray(vector) && vector.every((value) => typeof value === "number")
        )
      : [];
    const expiresAt = Date.parse(String(result.data.expires_at ?? ""));
    return {
      cacheKey: String(result.data.cache_key),
      queryEmbeddings: embeddings,
      evidence: evidenceFromRows(result.data.evidence),
      sourceHash: typeof result.data.source_hash === "string" ? result.data.source_hash : null,
      expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0
    };
  } catch {
    // The cache is an optimization. Career Brain must continue to work before
    // the optional cache migration has been applied or during a cache outage.
    return null;
  }
}

async function writeRetrievalCache(
  client: SupabaseClient,
  ownerId: string,
  cacheKey: string,
  provider: { provider: string; model: string; model_version: string | null | undefined },
  queryEmbeddings: number[][],
  evidence: RetrievedEvidence[],
  sourceHash: string
) {
  try {
    await client
      .schema("app")
      .from("career_brain_retrieval_cache")
      .upsert(
        {
          owner_id: ownerId,
          cache_key: cacheKey,
          embedding_provider: provider.provider,
          embedding_model: provider.model,
          embedding_model_version: provider.model_version ?? "",
          query_embeddings: queryEmbeddings,
          evidence,
          source_hash: sourceHash,
          refreshed_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + CAREER_BRAIN_RAG_CACHE_TTL_MS).toISOString()
        },
        { onConflict: "owner_id,cache_key" }
      );
  } catch {
    // Never turn a successful synthesis into a failure because cache storage
    // is unavailable.
  }
}

function compactCanonicalFacts(value: unknown) {
  return boundedRecords(
    records(value).map((item) => {
      const version = firstRecord(item.currentVersion);
      return {
        id: item.id,
        type: item.fact_type,
        statement: text(version?.statement).slice(0, 2500),
        structuredValue: record(version?.structured_value),
        updatedAt: item.updated_at
      };
    }),
    600,
    70_000
  );
}

function compactExtractedFacts(value: unknown) {
  const seen = new Set<string>();
  const compact = records(value).flatMap((item) => {
    const statement = text(item.statement).slice(0, 2500);
    const key = statement.toLocaleLowerCase().replace(/\s+/g, " ");
    if (!key || seen.has(key)) return [];
    seen.add(key);
    const ingestion = firstRecord(item.ingestion_items);
    const document = firstRecord(ingestion?.documents);
    return [
      {
        id: item.id,
        statement,
        subject: record(item.subject_candidate),
        confidence: item.confidence,
        sourceName: text(document?.name),
        documentKind: text(document?.document_kind, "other")
      }
    ];
  });
  return boundedRecords(compact, 750, 90_000);
}

function compactJournals(value: unknown) {
  return boundedRecords(
    records(value).map((entry) => {
      const version = [...records(entry.journal_versions)].sort(
        (left, right) => Number(right.version) - Number(left.version)
      )[0];
      return {
        id: entry.id,
        title: text(entry.title).slice(0, 500),
        entryDate: entry.entry_date,
        updatedAt: entry.updated_at,
        text: text(version?.text).slice(0, 4000)
      };
    }),
    100,
    50_000
  );
}

function compactApplications(value: unknown) {
  return boundedRecords(
    records(value).map((application) => {
      const job = firstRecord(application.jobs);
      return {
        id: application.id,
        status: application.status,
        createdAt: application.created_at,
        appliedAt: application.applied_at,
        title: text(job?.canonical_title).slice(0, 500),
        company: text(job?.canonical_company).slice(0, 500),
        description: text(job?.current_description).slice(0, 2000)
      };
    }),
    50,
    35_000
  );
}

function stableId(prefix: string, parts: string[]) {
  return `${prefix}:${createHash("sha256").update(parts.join("|").toLowerCase()).digest("hex").slice(0, 20)}`;
}

export function normalizeCareerBrainContent(value: unknown): CareerBrainContent {
  const root = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const normalized: CareerBrainContent = {
    cvSummary: text(root.cvSummary),
    portfolioSummary: text(root.portfolioSummary),
    about: text(root.about),
    experiences: (() => {
      const merged = new Map<string, Record<string, unknown>>();
      for (const item of records(root.experiences).slice(0, 50)) {
        const organization = text(item.organization, "Organisation not identified");
        const role = text(item.role, "Role not identified");
        const key = `${organization}|${role}`.toLocaleLowerCase().replace(/\s+/g, " ");
        const previous = merged.get(key);
        const points = selectRolePoints(item);
        const mergedItem = {
          ...(previous ?? {}),
          organization,
          role,
          period: text(previous?.period, text(item.period)),
          summary: text(previous?.summary, text(item.summary)),
          responsibilities: uniqueStrings(
            [...strings(previous?.responsibilities), ...points.responsibilities],
            7
          ),
          achievements: uniqueStrings(
            [...strings(previous?.achievements), ...points.achievements],
            7
          ),
          impact: uniqueStrings([...strings(previous?.impact), ...points.impact], 7),
          projects: uniqueStrings([...strings(previous?.projects), ...strings(item.projects)], 8),
          technologies: uniqueStrings(
            [...strings(previous?.technologies), ...strings(item.technologies)],
            30
          ),
          evidence: uniqueStrings([...strings(previous?.evidence), ...strings(item.evidence)], 12)
        };
        merged.set(key, mergedItem);
      }
      return [...merged.values()].slice(0, 30).map((item) => {
        const points = selectRolePoints(item);
        return {
          id: stableId("experience", [text(item.organization), text(item.role), text(item.period)]),
          organization: text(item.organization, "Organisation not identified"),
          role: text(item.role, "Role not identified"),
          period: text(item.period),
          summary: text(item.summary),
          responsibilities: points.responsibilities,
          achievements: points.achievements,
          impact: points.impact,
          projects: uniqueStrings(item.projects, 8),
          technologies: uniqueStrings(item.technologies, 30),
          evidence: uniqueStrings(item.evidence, 12)
        };
      });
    })(),
    projects: (() => {
      const merged = new Map<string, Record<string, unknown>>();
      for (const item of records(root.projects).slice(0, 50)) {
        const title = text(item.title, "Untitled project");
        const key = title.toLocaleLowerCase().replace(/\s+/g, " ");
        const previous = merged.get(key);
        merged.set(key, {
          ...(previous ?? {}),
          title,
          summary: text(previous?.summary, text(item.summary)),
          role: text(previous?.role, text(item.role)),
          outcome: text(previous?.outcome, text(item.outcome)),
          technologies: uniqueStrings(
            [...strings(previous?.technologies), ...strings(item.technologies)],
            30
          ),
          url: text(previous?.url, text(item.url)),
          process: uniqueStrings([...strings(previous?.process), ...strings(item.process)], 8),
          evidence: uniqueStrings([...strings(previous?.evidence), ...strings(item.evidence)], 12)
        });
      }
      return [...merged.values()].slice(0, 30).map((item) => ({
        id: stableId("project", [text(item.title)]),
        title: text(item.title, "Untitled project"),
        summary: text(item.summary),
        role: text(item.role),
        outcome: text(item.outcome),
        technologies: uniqueStrings(item.technologies, 30),
        url: text(item.url),
        process: uniqueStrings(item.process, 8),
        evidence: uniqueStrings(item.evidence, 12)
      }));
    })(),
    education: records(root.education)
      .slice(0, 30)
      .map((item) => {
        const qualification = text(item.qualification, "Education");
        const institution = text(item.institution);
        return {
          id: stableId("education", [qualification, institution]),
          qualification,
          institution,
          period: text(item.period),
          summary: text(item.summary)
        };
      }),
    certifications: records(root.certifications)
      .slice(0, 50)
      .map((item) => {
        const name = text(item.name, "Certification");
        const issuer = text(item.issuer);
        return {
          id: stableId("certification", [name, issuer]),
          name,
          issuer,
          date: text(item.date),
          summary: text(item.summary)
        };
      }),
    technicalSkills: (() => {
      const merged = new Map<string, Record<string, unknown>>();
      for (const item of records(root.technicalSkills).slice(0, 30)) {
        const category = text(item.category, "Technical skills");
        const key = category.toLocaleLowerCase().replace(/\s+/g, " ").trim();
        const previous = merged.get(key);
        merged.set(key, {
          category,
          skills: uniqueStrings([...strings(previous?.skills), ...strings(item.skills)], 50),
          summary: text(previous?.summary, text(item.summary))
        });
      }
      return [...merged.values()].map((item) => {
        const category = text(item.category, "Technical skills");
        return {
          id: stableId("skill", [category]),
          category,
          skills: uniqueStrings(item.skills, 50),
          summary: text(item.summary)
        };
      });
    })()
  };
  return anonymizePrivateEmployer(normalized) as CareerBrainContent;
}

async function loadInputs(client: SupabaseClient, ownerId: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [facts, extracted, journals, applications] = await Promise.all([
    client
      .schema("app")
      .from("career_facts")
      .select(
        "id,fact_type,updated_at,currentVersion:career_fact_versions!career_facts_current_version_fk(statement,structured_value)"
      )
      .eq("owner_id", ownerId)
      .neq("review_status", "rejected")
      .order("id")
      .limit(1000),
    client
      .schema("app")
      .from("extracted_facts")
      .select(
        "id,statement,subject_candidate,confidence,ingestion_items!inner(ingestion_runs!inner(owner_id),documents(name,document_kind))"
      )
      .eq("ingestion_items.ingestion_runs.owner_id", ownerId)
      .not("review_status", "in", "(rejected,excluded_document_type,superseded_reprocess)")
      .order("id")
      .limit(2000),
    client
      .schema("app")
      .from("journal_entries")
      .select("id,title,entry_date,updated_at,journal_versions(version,text)")
      .eq("owner_id", ownerId)
      .is("deleted_at", null)
      .order("entry_date", { ascending: false })
      .limit(200),
    client
      .schema("app")
      .from("applications")
      .select(
        "id,status,created_at,applied_at,jobs(canonical_title,canonical_company,current_description)"
      )
      .eq("owner_id", ownerId)
      .or(`created_at.gte.${since},applied_at.gte.${since}`)
      .order("created_at", { ascending: false })
      .limit(100)
  ]);
  for (const result of [facts, extracted, journals, applications])
    if (result.error) throw result.error;
  // Provider prompts must contain career evidence, not the complete relational
  // response. Compacting here prevents large document libraries from exceeding
  // the orchestrator context or request timeout while retaining provenance.
  const source = {
    facts: compactCanonicalFacts(facts.data),
    extracted: compactExtractedFacts(extracted.data),
    journals: compactJournals(journals.data),
    recentApplications: compactApplications(applications.data)
  };
  return {
    source,
    sourceHash: createHash("sha256")
      .update(JSON.stringify({ version: CAREER_BRAIN_SYNTHESIS_VERSION, source }))
      .digest("hex")
  };
}

async function refreshCareerBrainRetrievalCache(
  client: SupabaseClient,
  ownerId: string,
  sourceHash: string,
  serviceMode = false,
  options: { forceFresh?: boolean } = {}
) {
  const forceFresh = options.forceFresh === true;
  const embeddingProviders = await resolveEmbeddingProviders(client, ownerId);
  const queries = [
    "employment history organisations roles dates responsibilities achievements measurable impact",
    "selected personal and professional software data artificial intelligence projects outcomes",
    "technical skills programming languages platforms tools frameworks data and AI technologies",
    "education certifications credentials courses issuers dates",
    "professional profile strengths leadership working style and portfolio about biography"
  ];
  const embeddingProvider = embeddingProviders[0];
  if (!embeddingProvider) throw new Error("EMBEDDING_PROVIDER_NOT_CONFIGURED");
  const cacheKey = retrievalCacheKey(ownerId, embeddingProvider, queries, serviceMode);
  const cached = forceFresh ? null : await readRetrievalCache(client, ownerId, cacheKey);
  const cacheMatchesSource = Boolean(cached && cached.sourceHash === sourceHash);
  const cacheFresh = Boolean(
    cacheMatchesSource && cached && cached.expiresAt > Date.now() && cached.queryEmbeddings.length
  );
  // A normal refresh is cache-first. A manual re-synthesis deliberately skips
  // both cached query embeddings and cached evidence so that Supabase RAG is
  // queried again against the current private evidence set.
  if (cacheFresh && !forceFresh && cached?.evidence.length) {
    return { evidence: cached.evidence, cacheHit: true, freshCount: 0 };
  }
  const embedded =
    !forceFresh && cached?.queryEmbeddings.length
      ? { vectors: cached.queryEmbeddings, provider: embeddingProvider }
      : await embedWithFallback(embeddingProviders, queries);
  const freshLimit = cacheFresh && !forceFresh ? 6 : 20;
  const retrievalResults = await Promise.all(
    embedded.vectors.map((vector) =>
      client
        .schema("app")
        .rpc(serviceMode ? "match_owner_private_evidence" : "match_private_evidence", {
          ...(serviceMode ? { requested_owner: ownerId } : {}),
          requested_embedding: `[${vector.join(",")}]`,
          requested_provider: embedded.provider.provider,
          requested_model: embedded.provider.model,
          requested_model_version: embedded.provider.model_version,
          requested_kinds: ["resume", "cover_letter", "other"],
          requested_limit: freshLimit,
          requested_min_similarity: 0.12
        })
    )
  );
  const freshEvidence = retrievalResults.flatMap((result) => {
    if (result.error) throw result.error;
    return evidenceFromRows(result.data);
  });
  const rerankedFreshEvidence = await rerankCandidates(
    client,
    ownerId,
    queries.join("\n"),
    mergeEvidence(freshEvidence),
    40
  );
  const evidence = forceFresh
    ? rerankedFreshEvidence
    : mergeEvidence(rerankedFreshEvidence, cacheMatchesSource ? (cached?.evidence ?? []) : []);
  await writeRetrievalCache(
    client,
    ownerId,
    retrievalCacheKey(ownerId, embedded.provider, queries, serviceMode),
    embedded.provider,
    embedded.vectors,
    evidence,
    sourceHash
  );
  return { evidence, cacheHit: Boolean(cached), freshCount: freshEvidence.length };
}

export async function synthesizeCareerBrain(
  client: SupabaseClient,
  ownerId: string,
  options: {
    serviceMode?: boolean;
    refreshRetrievalCache?: boolean;
    forceFresh?: boolean;
  } = {}
) {
  const forceFresh = options.forceFresh === true;
  const { source, sourceHash } = await loadInputs(client, ownerId);
  const existing = await client
    .schema("app")
    .from("career_brain_snapshots")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("input_source_hash", sourceHash)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;
  const existingSnapshot = existing.data as unknown as Record<string, unknown> | null;
  if (existingSnapshot && !forceFresh) {
    if (options.refreshRetrievalCache) {
      await refreshCareerBrainRetrievalCache(client, ownerId, sourceHash, options.serviceMode);
    }
    return { snapshot: existingSnapshot, reused: true };
  }

  const { evidence } = await refreshCareerBrainRetrievalCache(
    client,
    ownerId,
    sourceHash,
    options.serviceMode,
    { forceFresh }
  );
  const providers = (await resolveReasoningProviders(client, ownerId, "evidence_extraction")).map(
    (provider) => ({
      ...provider,
      timeoutMs: Math.max(provider.timeoutMs, CAREER_BRAIN_TIMEOUT_MS)
    })
  );
  const generation = await generateReasoningJson(
    providers,
    [
      "Do not mention Thames Water or close variants in generated output; use work from that source as evidence but anonymize the employer.",
      "Prioritize data-engineering and data-platform experience such as pipelines, warehouses, modelling, orchestration, quality, governance, reliability, scale, and delivery tools over generic software responsibilities."
    ].join(" ") +
      " " +
      `You maintain Basil Ogbonna's private Career Brain. Return JSON only. Synthesize, deduplicate and reconcile all supplied CVs, extracted facts, journals, and evidence without inventing facts. The recentApplicationFocus input contains target job descriptions: use those descriptions only to rank which verified bullets are most useful for the roles Basil is pursuing; never treat a job description as proof that Basil did something. Preserve useful detail instead of collapsing evidence into generic summaries. Write like a thoughtful senior engineer speaking plainly: specific, warm, confident, and grounded in real work. Use natural sentence structure and varied wording; avoid keyword stuffing, corporate clichés, exaggerated claims, empty phrases such as "results-driven" or "passionate professional", and repetitive AI-style openings. Keep the CV profile concise and professional, but make portfolioSummary and about sound like Basil's own first-person voice. Output cvSummary (concise CV profile), portfolioSummary (human first-person portfolio profile), about (first-person About narrative), experiences[], projects[], education[], certifications[], technicalSkills[]. Each experience must represent exactly one role at one organization. Merge repeated versions of the same organization and role into one record, even when the same bullet appears in several CVs. For each role select the strongest 6-7 combined points across responsibilities[], achievements[], and impact[]; do not return 6-7 in every list. Prefer points that match the target job descriptions while retaining important role-defining work. Responsibilities are action-and-scope bullets, achievements are specific accomplishments, and impact is measurable or observable outcomes such as scale, reliability, speed, cost, quality, users, or business effect; do not duplicate the same point across lists. Also include projects[] (named initiatives carried out in that role), technologies[] (exact tools, platforms, languages, and methods), and evidence[] (short source-grounded details or source labels explaining where the role and outcomes came from). Keep dates, scope, metrics, and technical names when present. Projects contain title, summary, role, outcome, technologies[], url, process[] (important design/build/engineering steps), and evidence[] (source-grounded details). Education contains qualification, institution, period, summary. Certifications contain name, issuer, date, summary. technicalSkills groups contain category, skills[], summary. Prefer corroborated specifics; omit uncertain entries rather than guessing, but do not omit a supported detail merely because it is lengthy.`,
    {
      semanticEvidence: evidence,
      canonicalPrivateFacts: source.facts,
      extractedPrivateFacts: source.extracted,
      journalEvidence: source.journals,
      recentApplicationFocus: source.recentApplications
    },
    { task: "evidence_extraction" }
  );
  const content = normalizeCareerBrainContent(generation.output);
  // Snapshots are append-only by run key. A forced re-synthesis must be able
  // to produce a new snapshot even when the underlying source hash has not
  // changed, otherwise the unique key would silently return the older result.
  const snapshotSourceHash = forceFresh
    ? createHash("sha256")
        .update(`${sourceHash}:resynthesis:${String(Date.now())}:${randomUUID()}`)
        .digest("hex")
    : sourceHash;
  const insert = await client
    .schema("app")
    .from("career_brain_snapshots")
    .insert({
      owner_id: ownerId,
      source_hash: snapshotSourceHash,
      input_source_hash: sourceHash,
      content,
      focus_jobs: source.recentApplications,
      provider: generation.provider.provider,
      model: generation.provider.model,
      model_version: generation.provider.model_version,
      input_hash: generation.inputHash,
      output_hash: generation.outputHash
    })
    .select("*")
    .single();
  if (insert.error || !insert.data) {
    // Two refresh requests can synthesize the same source hash concurrently.
    // The first insert wins; the other request should reuse that durable result
    // rather than surface a false generation failure to the owner.
    if (insert.error?.code === "23505") {
      const concurrent = await client
        .schema("app")
        .from("career_brain_snapshots")
        .select("*")
        .eq("owner_id", ownerId)
        .eq("input_source_hash", sourceHash)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!concurrent.error && concurrent.data) {
        return {
          snapshot: concurrent.data as unknown as Record<string, unknown>,
          reused: true
        };
      }
    }
    throw insert.error ?? new Error("CAREER_BRAIN_SAVE_FAILED");
  }
  const snapshot = insert.data as unknown as Record<string, unknown>;
  return { snapshot, reused: false };
}
