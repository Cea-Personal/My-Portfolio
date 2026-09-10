import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { embedWithFallback, resolveEmbeddingProviders } from "./embedding-provider";
import { generateReasoningJson, resolveReasoningProviders } from "./reasoning-provider";
import { rerankCandidates } from "./reranker-provider";
import { EMPLOYER_PRIVACY_INSTRUCTION } from "./retrieval-policy";

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

const NON_INFORMATION_VALUES = new Set([
  "",
  "role not identified",
  "organisation not identified",
  "untitled project",
  "education",
  "certification",
  "technical skills"
]);

export const CAREER_PROJECT_CATEGORIES = [
  "Software",
  "AI software engineering",
  "Data platform",
  "Data engineering",
  "AI engineering",
  "AI data engineering"
] as const;

function usefulText(value: unknown): boolean {
  return typeof value === "string" && !NON_INFORMATION_VALUES.has(value.trim().toLocaleLowerCase());
}

function usefulList(value: unknown): boolean {
  return Array.isArray(value) && value.some((entry) => usefulText(entry));
}

/** Prevent an empty `{}` agent response from replacing a usable snapshot. */
export function hasMeaningfulCareerBrainContent(content: CareerBrainContent): boolean {
  if ([content.cvSummary, content.portfolioSummary, content.about].some(usefulText)) return true;
  if (
    content.experiences.some(
      (item) =>
        ["organization", "role", "period", "summary"].some((key) => usefulText(item[key])) ||
        [
          "experience",
          "responsibilities",
          "achievements",
          "impact",
          "outcomes",
          "outcome",
          "projects",
          "technologies",
          "evidence"
        ].some((key) => usefulList(item[key]))
    )
  )
    return true;
  if (
    content.projects.some(
      (item) =>
        ["title", "summary", "description", "problem", "approach", "role", "outcome", "url", "liveUrl", "githubUrl", "videoUrl"].some((key) => usefulText(item[key])) ||
        ["highlights", "technologies", "process", "evidence"].some((key) => usefulList(item[key]))
    )
  )
    return true;
  if (
    content.education.some((item) =>
      ["qualification", "institution", "period", "summary"].some((key) => usefulText(item[key]))
    )
  )
    return true;
  if (
    content.certifications.some((item) =>
      ["name", "issuer", "date", "summary"].some((key) => usefulText(item[key]))
    )
  )
    return true;
  return content.technicalSkills.some(
    (item) => usefulText(item.category) || usefulText(item.summary) || usefulList(item.skills)
  );
}

// Increment when the synthesis contract or prompt changes so an existing
// snapshot cannot silently keep the older, summary-only shape.
const CAREER_BRAIN_SYNTHESIS_VERSION = "career-brain.v8.project-detail-media";

// Career Brain is a bounded synthesis job, not a health probe. Native Codex
// subagents can need more time to reconcile multiple documents and produce the
// complete structured profile requested by the schema. Keep this below the
// route's five-minute budget so embedding, reranking, and persistence have
// room to finish in the same request.
const CAREER_BRAIN_TIMEOUT_MS = 180_000;
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

/** Merge legacy CV categories into one detailed, de-duplicated role narrative. */
function selectRoleExperience(item: Record<string, unknown>, limit = 10): string[] {
  return uniqueStrings(
    [
      ...strings(item.experience),
      ...strings(item.responsibilities),
      ...strings(item.achievements),
      ...strings(item.impact),
      ...strings(item.outcomes),
      ...(typeof item.outcome === "string" ? [item.outcome] : [])
    ],
    limit
  );
}

type CareerProjectCategory = (typeof CAREER_PROJECT_CATEGORIES)[number];

function projectCategory(item: Record<string, unknown>): CareerProjectCategory {
  const suppliedValues = [
    ...strings(item.categories),
    ...(typeof item.category === "string" ? [item.category] : [])
  ];
  const explicit = CAREER_PROJECT_CATEGORIES.find((category) =>
    suppliedValues.some(
      (value) => value.trim().toLocaleLowerCase() === category.toLocaleLowerCase()
    )
  );
  if (explicit) return explicit;
  const supplied = suppliedValues.join(" ").toLocaleLowerCase();
  const haystack = [
    supplied,
    text(item.title),
    text(item.summary),
    text(item.role),
    text(item.outcome),
    ...strings(item.technologies),
    ...strings(item.process)
  ]
    .join(" ")
    .toLocaleLowerCase();
  const hasAi =
    /\b(ai|ml|machine learning|llm|rag|vector|embedding|model|artificial intelligence)\b/.test(
      haystack
    );
  const hasData =
    /\b(data|etl|elt|pipeline|warehouse|lakehouse|analytics|sql|dbt|airflow|spark)\b/.test(
      haystack
    );
  const hasSoftware =
    /\b(software|web|application|api|backend|frontend|typescript|javascript|react|node|service)\b/.test(
      haystack
    );
  const hasPlatform =
    /\b(platform|infrastructure|kubernetes|docker|cloud|terraform|deployment|observability|reliability)\b/.test(
      haystack
    );
  if (hasAi && hasData) return "AI data engineering";
  if (hasAi && hasSoftware) return "AI software engineering";
  if (hasAi) return "AI engineering";
  if (hasData && hasPlatform) return "Data platform";
  if (hasData) return "Data engineering";
  return "Software";
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
    return value.replace(
      /\bthames[\s-]+water(?:\s+(?:plc|limited|ltd))?\b/gi,
      "a utilities organisation"
    );
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
    // Keep the RAG context bounded. The source tables already contain the
    // complete text; synthesis only needs the highest-ranked excerpts.
    const content = text(item.content).slice(0, 1_800);
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
  return [...merged.values()].slice(0, 32);
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
  const compact = records(value).map((item) => {
    const version = firstRecord(item.currentVersion);
    return {
      id: item.id,
      type: item.fact_type,
      statement: text(version?.statement).slice(0, 2500),
      structuredValue: record(version?.structured_value),
      updatedAt: item.updated_at
    };
  });
  // Project facts are first-class Career Brain inputs. Put them ahead of the
  // general fact stream so a large history cannot consume the context budget
  // before distinct project records reach the synthesizer.
  const projects = compact.filter((item) => item.type === "project");
  const otherFacts = compact.filter((item) => item.type !== "project");
  return boundedRecords([...projects, ...otherFacts], 500, 60_000);
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
  return boundedRecords(compact, 450, 55_000);
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
    50,
    20_000
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
    30,
    20_000
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
        const experience = selectRoleExperience(item);
        const mergedItem = {
          ...(previous ?? {}),
          organization,
          role,
          period: text(previous?.period, text(item.period)),
          summary: text(previous?.summary, text(item.summary)),
          experience: uniqueStrings([...strings(previous?.experience), ...experience], 10),
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
        return {
          id: stableId("experience", [text(item.organization), text(item.role), text(item.period)]),
          organization: text(item.organization, "Organisation not identified"),
          role: text(item.role, "Role not identified"),
          period: text(item.period),
          summary: text(item.summary),
          experience: selectRoleExperience(item),
          projects: uniqueStrings(item.projects, 8),
          technologies: uniqueStrings(item.technologies, 30),
          evidence: uniqueStrings(item.evidence, 12)
        };
      });
    })(),
    projects: (() => {
      const merged = new Map<string, Record<string, unknown>>();
      for (const item of records(root.projects).slice(0, 100)) {
        const title = text(item.title, "Untitled project");
        const key = title.toLocaleLowerCase().replace(/\s+/g, " ");
        const previous = merged.get(key);
        merged.set(key, {
          ...(previous ?? {}),
          title,
          category: projectCategory(item),
          summary: text(previous?.summary, text(item.summary)),
          description: text(previous?.description, text(item.description)),
          problem: text(previous?.problem, text(item.problem)),
          approach: text(previous?.approach, text(item.approach)),
          role: text(previous?.role, text(item.role)),
          outcome: text(previous?.outcome, text(item.outcome)),
          highlights: uniqueStrings(
            [...strings(previous?.highlights), ...strings(item.highlights)],
            12
          ),
          technologies: uniqueStrings(
            [...strings(previous?.technologies), ...strings(item.technologies)],
            30
          ),
          url: text(previous?.url, text(item.url)),
          liveUrl: text(previous?.liveUrl, text(item.liveUrl)),
          githubUrl: text(previous?.githubUrl, text(item.githubUrl)),
          videoUrl: text(previous?.videoUrl, text(item.videoUrl)),
          process: uniqueStrings([...strings(previous?.process), ...strings(item.process)], 8),
          evidence: uniqueStrings([...strings(previous?.evidence), ...strings(item.evidence)], 12)
        });
      }
      return [...merged.values()].slice(0, 100).map((item) => ({
        id: stableId("project", [text(item.title)]),
        title: text(item.title, "Untitled project"),
        category: projectCategory(item),
        summary: text(item.summary),
        description: text(item.description),
        problem: text(item.problem),
        approach: text(item.approach),
        role: text(item.role),
        outcome: text(item.outcome),
        highlights: uniqueStrings(item.highlights, 12),
        technologies: uniqueStrings(item.technologies, 30),
        url: text(item.url),
        liveUrl: text(item.liveUrl),
        githubUrl: text(item.githubUrl),
        videoUrl: text(item.videoUrl),
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
        const skills = uniqueStrings(item.skills, 50);
        return {
          id: stableId("skill", [category, ...skills]),
          category,
          skills,
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
    "employment history organisations roles dates detailed experience responsibilities achievements measurable impact outcomes",
    "selected personal and professional software data artificial intelligence projects outcomes categories",
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
    24
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
  const existingResult = await client
    .schema("app")
    .from("career_brain_snapshots")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("input_source_hash", sourceHash)
    .order("generated_at", { ascending: false })
    .limit(20);
  if (existingResult.error) throw existingResult.error;
  const existingSnapshot = records(existingResult.data).find((candidate) =>
    hasMeaningfulCareerBrainContent(normalizeCareerBrainContent(candidate.content))
  ) as unknown as Record<string, unknown> | undefined;
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
      EMPLOYER_PRIVACY_INSTRUCTION,
      "Prioritize data-engineering and data-platform experience such as pipelines, warehouses, modelling, orchestration, quality, governance, reliability, scale, and delivery tools over generic software responsibilities."
    ].join(" ") +
      " " +
      `You maintain Basil Ogbonna's private Career Brain. Return JSON only. Synthesize, deduplicate and reconcile all supplied CVs, extracted facts, and semantically retrieved private knowledge-base material without inventing facts. Journal entries are knowledge-base sources, so use only the journal excerpts returned by retrieval rather than a separate journal-insight workflow. The recentApplicationFocus input contains target job descriptions: use those descriptions only to rank which verified details are most useful for the roles Basil is pursuing; never treat a job description as proof that Basil did something. Preserve useful detail instead of collapsing evidence into generic summaries. Write like a thoughtful senior engineer speaking plainly: specific, warm, confident, and grounded in real work. Use natural sentence structure and varied wording; avoid keyword stuffing, corporate clichés, empty phrases such as "results-driven" or "passionate professional", repetitive AI-style openings, abstract proof language, and generic self-descriptions. Draw precise descriptors from the professional summaries and write what Basil actually did using concrete verbs such as built, designed, led, delivered, operated, improved, migrated, or supported only when the supplied material supports them. Keep the CV profile concise and professional, but make portfolioSummary and about sound like Basil's own first-person voice. Output cvSummary (concise CV profile), portfolioSummary (human first-person portfolio profile), about (first-person About narrative), experiences[], projects[], education[], certifications[], technicalSkills[]. Each experience must represent exactly one role at one organization. Merge repeated versions of the same organization and role into one record, even when the same detail appears in several CVs. For each role return no more than 10 detailed experience[] entries containing the most useful and specific combined responsibilities, achievements, impacts, and outcomes; do not split these into separate fields. Each entry may be a complete sentence, and should combine the action, scope, and outcome in one natural sentence when the source supports all three. Do not duplicate a detail within a role. Include every distinct supported project from the supplied career facts, CVs, and retrieved material; do not reduce the project list to only the most prominent examples. Assign each project exactly one category from: Software, AI software engineering, Data platform, Data engineering, AI engineering, AI data engineering. Also include technologies[] (exact tools, platforms, languages, and methods) and evidence[] (short source-grounded details or source labels explaining where the role and outcomes came from). Keep dates, scope, metrics, and technical names when present. Projects must be detailed: provide a useful summary of what was built and why, the role played, a concrete outcome when supported, technologies[], url when known, 4-8 process[] steps covering important design/build/engineering decisions, and evidence[] grounded in the supplied material. Education contains qualification, institution, period, summary. Certifications contain name, issuer, date, summary. technicalSkills groups contain category, skills[], summary. Prefer specific, natural wording taken from the professional summaries; omit uncertain entries rather than guessing, but do not omit a supported detail merely because it is lengthy.`,
    {
      semanticEvidence: evidence,
      canonicalPrivateFacts: source.facts,
      extractedPrivateFacts: source.extracted,
      recentApplicationFocus: source.recentApplications
    },
    { task: "evidence_extraction" }
  );
  const content = normalizeCareerBrainContent(generation.output);
  if (!hasMeaningfulCareerBrainContent(content)) {
    throw new Error("CAREER_BRAIN_EMPTY_OUTPUT:orchestrator returned no usable career content");
  }
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
      const concurrentResult = await client
        .schema("app")
        .from("career_brain_snapshots")
        .select("*")
        .eq("owner_id", ownerId)
        .eq("input_source_hash", sourceHash)
        .order("generated_at", { ascending: false })
        .limit(20);
      const concurrent = concurrentResult.error
        ? undefined
        : records(concurrentResult.data).find((candidate) =>
            hasMeaningfulCareerBrainContent(normalizeCareerBrainContent(candidate.content))
          );
      if (!concurrentResult.error && concurrent) {
        return {
          snapshot: concurrent as unknown as Record<string, unknown>,
          reused: true
        };
      }
    }
    throw insert.error ?? new Error("CAREER_BRAIN_SAVE_FAILED");
  }
  const snapshot = insert.data as unknown as Record<string, unknown>;
  return { snapshot, reused: false };
}
