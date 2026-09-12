import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { embedWithFallback, resolveEmbeddingProviders } from "./embedding-provider";
import { generateReasoningJson, resolveReasoningProviders } from "./reasoning-provider";
import { rerankCandidates } from "./reranker-provider";
import { EMPLOYER_PRIVACY_INSTRUCTION } from "./retrieval-policy";
import {
  normalizeCareerIdentity,
  projectCareerPlacement,
  sameCareerIdentity
} from "../portfolio-career-rules";

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

function excludedCareerExperience(organization: string, role: string): boolean {
  return (
    /one\s+acre\s+fund/i.test(organization) && /software\s+engineer\s*\(?.*backend/i.test(role)
  );
}

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
        ].some((key) => usefulList(item[key])) ||
        records(item.workProjects).length > 0
    )
  )
    return true;
  if (
    content.projects.some(
      (item) =>
        [
          "title",
          "summary",
          "description",
          "problem",
          "approach",
          "role",
          "outcome",
          "url",
          "liveUrl",
          "githubUrl",
          "videoUrl"
        ].some((key) => usefulText(item[key])) ||
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
const CAREER_BRAIN_SYNTHESIS_VERSION = "career-brain.v14.confirmed-role-project-ownership";

// Career Brain is a bounded synthesis job, not a health probe. Native Codex
// subagents can need more time to reconcile multiple documents and produce the
// complete structured profile requested by the schema. Keep this below the
// route's five-minute budget so embedding, reranking, and persistence have
// room to finish in the same request.
const CAREER_BRAIN_TIMEOUT_MS = 240_000;
const CAREER_BRAIN_RAG_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CAREER_BRAIN_RAG_CACHE_VERSION = "rag.v2.source-aware";

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

type CareerProjectType = "personal" | "open_source" | "professional" | "unknown";

function projectType(item: Record<string, unknown>): CareerProjectType {
  const supplied = [
    text(item.projectType),
    text(item.project_type),
    text(item.project_type_name),
    text(item.type)
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
  if (/professional|employment|client|company|workplace|organisation|organization/.test(supplied)) {
    return "professional";
  }
  if (/open[ -]?source/.test(supplied)) return "open_source";
  if (/personal|independent|side project|portfolio/.test(supplied)) return "personal";

  // The project facts imported from earlier Career Brain versions often carry
  // the classification in the role rather than a dedicated field.
  const role = text(item.role).toLocaleLowerCase();
  if (/independent|creator|personal project|open[ -]?source/.test(role)) {
    return /open[ -]?source/.test(role) ? "open_source" : "personal";
  }
  return "unknown";
}

function projectLinks(item: Record<string, unknown>) {
  const values = [
    ...strings(item.links),
    ...strings(item.externalLinks),
    text(item.url),
    text(item.liveUrl),
    text(item.githubUrl),
    text(item.videoUrl)
  ].filter(Boolean);
  const unique = uniqueStrings(values, 20);
  let url = text(item.url);
  let liveUrl = text(item.liveUrl);
  let githubUrl = text(item.githubUrl);
  let videoUrl = text(item.videoUrl);
  for (const candidate of unique) {
    if (/github\.com\//i.test(candidate) && !githubUrl) githubUrl = candidate;
    else if (/(?:youtube\.com|youtu\.be)\//i.test(candidate) && !videoUrl) videoUrl = candidate;
    else if (!liveUrl && /^https?:\/\//i.test(candidate)) liveUrl = candidate;
    else if (!url && /^https?:\/\//i.test(candidate)) url = candidate;
  }
  return { url, liveUrl, githubUrl, videoUrl, links: unique };
}

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
  sourceId?: string;
  sourceCreatedAt?: string;
  section?: unknown;
  content: string;
  similarity?: unknown;
};

type SourceDocument = {
  id: string;
  name: string;
  kind: string;
  createdAt: string;
  evidenceSourceId: string;
};

type SourceAwareExtractedFact = {
  id: string;
  statement: string;
  subject: Record<string, unknown> | null;
  confidence: unknown;
  sourceId: string;
  sourceName: string;
  documentKind: string;
  sourceCreatedAt: string;
};

type DocumentCareerInputs = {
  extracted: SourceAwareExtractedFact[];
  coverageEvidence: RetrievedEvidence[];
  evidenceFingerprint: Array<Record<string, unknown>>;
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
    const content = text(item.content).slice(0, 1_500);
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

/**
 * Preserve recent-source coverage before filling the remaining context with
 * globally ranked matches. Without this reservation, a large CV library can
 * repeatedly crowd newly indexed documents out of Career Brain synthesis.
 */
export function mergeSourceAwareEvidence(
  coverage: RetrievedEvidence[],
  semantic: RetrievedEvidence[],
  options: { maxSources?: number; perSource?: number; limit?: number } = {}
): RetrievedEvidence[] {
  const maxSources = options.maxSources ?? 6;
  const perSource = options.perSource ?? 2;
  const limit = options.limit ?? 24;
  const selected: RetrievedEvidence[] = [];
  const selectedIds = new Set<string>();
  const sourceCounts = new Map<string, number>();
  const sourceOrder: string[] = [];

  for (const item of coverage) {
    const sourceKey = item.sourceId || item.source || item.id;
    if (!sourceCounts.has(sourceKey)) {
      if (sourceOrder.length >= maxSources) continue;
      sourceOrder.push(sourceKey);
      sourceCounts.set(sourceKey, 0);
    }
    const count = sourceCounts.get(sourceKey) ?? 0;
    if (count >= perSource || selectedIds.has(item.id)) continue;
    selected.push(item);
    selectedIds.add(item.id);
    sourceCounts.set(sourceKey, count + 1);
  }

  for (const item of semantic) {
    if (selected.length >= limit) break;
    if (selectedIds.has(item.id)) continue;
    selected.push(item);
    selectedIds.add(item.id);
  }
  return selected.slice(0, limit);
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
  return boundedRecords([...projects, ...otherFacts], 350, 45_000);
}

/** Round-robin facts by source so every recent CV contributes before any one CV dominates. */
export function compactSourceAwareExtractedFacts(value: unknown) {
  const facts = records(value)
    .map((item) => ({
      id: text(item.id),
      statement: text(item.statement).slice(0, 2500),
      subject: record(item.subject),
      confidence: item.confidence,
      sourceId: text(item.sourceId),
      sourceName: text(item.sourceName),
      documentKind: text(item.documentKind, "other"),
      sourceCreatedAt: text(item.sourceCreatedAt)
    }))
    .filter((item) => item.id && item.statement && item.documentKind !== "cover_letter")
    .sort((left, right) => right.sourceCreatedAt.localeCompare(left.sourceCreatedAt));
  const bySource = new Map<string, typeof facts>();
  for (const item of facts) {
    const key = item.sourceId || item.sourceName || item.id;
    const sourceFacts = bySource.get(key) ?? [];
    sourceFacts.push(item);
    bySource.set(key, sourceFacts);
  }

  const compact: typeof facts = [];
  const seen = new Set<string>();
  let characters = 0;
  const append = (item: (typeof facts)[number] | undefined) => {
    if (!item) return false;
    const key = item.statement.toLocaleLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    const size = JSON.stringify(item).length;
    if (characters + size > 45_000 || compact.length >= 360) return false;
    seen.add(key);
    compact.push(item);
    characters += size;
    return true;
  };

  // Give the newest documents enough contiguous facts to describe roles and
  // projects in detail, then share the remaining budget across the full set.
  for (const sourceFacts of [...bySource.values()].slice(0, 12)) {
    for (const item of sourceFacts.slice(0, 6)) append(item);
  }
  let offset = 0;
  while (compact.length < 360 && characters < 45_000) {
    let added = false;
    for (const sourceFacts of bySource.values()) {
      const item = sourceFacts[offset];
      if (!item) continue;
      added = append(item) || added;
      if (compact.length >= 360) break;
    }
    if (!added && [...bySource.values()].every((sourceFacts) => !sourceFacts[offset + 1])) break;
    offset += 1;
  }
  // Source ordering fields are selection metadata, not synthesis evidence.
  // Removing them reduces the native parent/child prompt without discarding a
  // career statement, its provenance label, or confidence.
  return compact.map((item) => ({
    id: item.id,
    statement: item.statement,
    subject: item.subject,
    confidence: item.confidence,
    sourceName: item.sourceName,
    documentKind: item.documentKind
  }));
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function representativeChunks(value: unknown): Record<string, unknown>[] {
  const candidates = records(value)
    .filter((item) => item.deleted_at == null && text(item.content))
    .sort((left, right) => Number(left.ordinal ?? 0) - Number(right.ordinal ?? 0));
  if (candidates.length <= 2) return candidates;
  // The first and a later chunk normally span the profile/skills and detailed
  // experience/project portions of a CV better than two adjacent chunks.
  return [candidates[0], candidates[Math.max(1, candidates.length - 1)]].filter(
    (item): item is Record<string, unknown> => Boolean(item)
  );
}

async function loadDocumentCareerInputs(
  client: SupabaseClient,
  ownerId: string
): Promise<DocumentCareerInputs> {
  const documentResult = await client
    .schema("app")
    .from("documents")
    .select("id,name,document_kind,created_at,evidence_source_id")
    .eq("owner_id", ownerId)
    .is("removed_at", null)
    .is("duplicate_of_id", null)
    .eq("availability", "available")
    .neq("document_kind", "cover_letter")
    .order("created_at", { ascending: false })
    .limit(120);
  if (documentResult.error) throw documentResult.error;
  const documents: SourceDocument[] = records(documentResult.data).flatMap((item) => {
    const id = text(item.id);
    if (!id) return [];
    return [
      {
        id,
        name: text(item.name, "Career document"),
        kind: text(item.document_kind, "other"),
        createdAt: text(item.created_at),
        evidenceSourceId: text(item.evidence_source_id)
      }
    ];
  });
  if (!documents.length) {
    return { extracted: [], coverageEvidence: [], evidenceFingerprint: [] };
  }

  const documentById = new Map(documents.map((document) => [document.id, document] as const));
  const sourceById = new Map(
    documents
      .filter((document) => document.evidenceSourceId)
      .map((document) => [document.evidenceSourceId, document] as const)
  );
  const [ingestionResult, sourceResult] = await Promise.all([
    client
      .schema("app")
      .from("ingestion_items")
      .select("id,document_id,finished_at,status")
      .in(
        "document_id",
        documents.map((document) => document.id)
      )
      .eq("status", "completed")
      .order("finished_at", { ascending: false })
      .limit(500),
    sourceById.size
      ? client
          .schema("app")
          .from("evidence_sources")
          .select(
            "id,evidence_versions(id,ordinal,normalized_text_sha256,processed_at,quarantine_status,evidence_chunks(id,ordinal,section_path,content,deleted_at))"
          )
          .in("id", [...sourceById.keys()])
      : Promise.resolve({ data: [], error: null })
  ]);
  if (ingestionResult.error) throw ingestionResult.error;
  if (sourceResult.error) throw sourceResult.error;

  // A document can be reprocessed repeatedly. Only its newest completed item
  // is relevant; older extraction copies add noise and consume prompt budget.
  const latestItemByDocument = new Map<string, string>();
  for (const item of records(ingestionResult.data)) {
    const documentId = text(item.document_id);
    const itemId = text(item.id);
    if (documentId && itemId && !latestItemByDocument.has(documentId)) {
      latestItemByDocument.set(documentId, itemId);
    }
  }
  const itemToDocument = new Map(
    [...latestItemByDocument.entries()].map(([documentId, itemId]) => [itemId, documentId] as const)
  );
  const factResults = await Promise.all(
    chunks([...itemToDocument.keys()], 12).map((itemIds) =>
      client
        .schema("app")
        .from("extracted_facts")
        .select("id,ingestion_item_id,statement,subject_candidate,confidence,review_status")
        .in("ingestion_item_id", itemIds)
        .not("review_status", "in", "(rejected,excluded_document_type,superseded_reprocess)")
        .limit(1000)
    )
  );
  const extracted = factResults.flatMap((result) => {
    if (result.error) throw result.error;
    return records(result.data).flatMap((item): SourceAwareExtractedFact[] => {
      const documentId = itemToDocument.get(text(item.ingestion_item_id));
      const document = documentId ? documentById.get(documentId) : undefined;
      const id = text(item.id);
      const statement = text(item.statement).slice(0, 2500);
      if (!document || !id || !statement) return [];
      return [
        {
          id,
          statement,
          subject: record(item.subject_candidate),
          confidence: item.confidence,
          sourceId: document.id,
          sourceName: document.name,
          documentKind: document.kind,
          sourceCreatedAt: document.createdAt
        }
      ];
    });
  });

  const coverageEvidence: RetrievedEvidence[] = [];
  const evidenceFingerprint: Array<Record<string, unknown>> = [];
  for (const source of records(sourceResult.data)) {
    const sourceId = text(source.id);
    const document = sourceById.get(sourceId);
    if (!document) continue;
    const versions = records(source.evidence_versions)
      .filter((version) => text(version.quarantine_status) === "approved")
      .sort((left, right) => {
        const ordinalDifference = Number(right.ordinal ?? 0) - Number(left.ordinal ?? 0);
        return ordinalDifference || text(right.processed_at).localeCompare(text(left.processed_at));
      });
    const version = versions[0];
    if (!version) continue;
    evidenceFingerprint.push({
      sourceId,
      documentId: document.id,
      versionId: text(version.id),
      contentHash: text(version.normalized_text_sha256),
      processedAt: text(version.processed_at)
    });
    for (const chunk of representativeChunks(version.evidence_chunks)) {
      const id = text(chunk.id);
      const content = text(chunk.content).slice(0, 1_500);
      if (!id || !content) continue;
      coverageEvidence.push({
        id,
        sourceId,
        source: document.name,
        sourceCreatedAt: document.createdAt,
        section: chunk.section_path,
        content
      });
    }
  }
  coverageEvidence.sort((left, right) =>
    (right.sourceCreatedAt ?? "").localeCompare(left.sourceCreatedAt ?? "")
  );
  evidenceFingerprint.sort((left, right) =>
    text(right.processedAt).localeCompare(text(left.processedAt))
  );
  return { extracted, coverageEvidence, evidenceFingerprint };
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
    24,
    15_000
  );
}

function focusedExtractedFacts(
  value: unknown,
  pattern: RegExp,
  maxItems: number,
  maxCharacters: number
) {
  const ranked = records(value)
    .map((item, index) => ({
      item,
      index,
      score: pattern.test(text(item.statement)) ? 1 : 0
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ item }) => item);
  return boundedRecords(ranked, maxItems, maxCharacters);
}

/**
 * Keep CV variants visibly separated in the synthesis input. This prevents a
 * top-ranked CV from looking like the sole source of truth and lets the agent
 * reconcile the union of supported details for each role.
 */
function extractedFactsBySource(value: unknown, pattern: RegExp) {
  const groups = new Map<
    string,
    { sourceName: string; documentKind: string; facts: Array<Record<string, unknown>> }
  >();
  for (const item of records(value)) {
    const statement = text(item.statement);
    if (!statement || !pattern.test(statement)) continue;
    const sourceName = text(item.sourceName, "Career document");
    const sourceKey = text(item.sourceId, sourceName);
    const group = groups.get(sourceKey) ?? {
      sourceName,
      documentKind: text(item.documentKind, "resume"),
      facts: []
    };
    group.facts.push({
      id: item.id,
      statement,
      subject: record(item.subject),
      confidence: item.confidence
    });
    groups.set(sourceKey, group);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    facts: group.facts.slice(0, 24)
  }));
}

function focusedEvidence(value: RetrievedEvidence[], pattern: RegExp, limit: number) {
  return value
    .map((item, index) => ({ item, index, score: pattern.test(item.content) ? 1 : 0 }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)
    .map(({ item }) => item);
}

function stableId(prefix: string, parts: string[]) {
  return `${prefix}:${createHash("sha256").update(parts.join("|").toLowerCase()).digest("hex").slice(0, 20)}`;
}

function normalizeTechnologies(value: unknown, limit: number) {
  return uniqueStrings(
    strings(value).flatMap((technology) =>
      /^pern(?:[\s-]+stack)?$/i.test(technology.trim())
        ? ["PostgreSQL", "Express.js", "React.js", "Node.js"]
        : [technology]
    ),
    limit
  );
}

function mergeWorkProjects(...values: unknown[]): Record<string, unknown>[] {
  const merged = new Map<string, Record<string, unknown>>();
  for (const item of values.flatMap(records)) {
    const title = text(item.title);
    if (!title) continue;
    const key = title
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    const previous = merged.get(key);
    merged.set(key, {
      title,
      summary: text(item.summary, text(previous?.summary)),
      outcome: text(item.outcome, text(previous?.outcome)),
      technologies: normalizeTechnologies(
        [...strings(previous?.technologies), ...strings(item.technologies)],
        20
      ),
      evidence: uniqueStrings([...strings(previous?.evidence), ...strings(item.evidence)], 12)
    });
  }
  return [...merged.values()].slice(0, 8);
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
        const identity = normalizeCareerIdentity(
          text(item.role, "Role not identified"),
          text(item.organization, "Organisation not identified"),
          text(item.period)
        );
        const { organization, role } = identity;
        if (excludedCareerExperience(organization, role)) continue;
        const key = `${organization}|${role}`.toLocaleLowerCase().replace(/\s+/g, " ");
        const previous = merged.get(key);
        const experience = selectRoleExperience(item);
        const mergedItem = {
          ...(previous ?? {}),
          organization,
          role,
          period: identity.period || text(previous?.period, text(item.period)),
          summary: text(previous?.summary, text(item.summary)),
          experience: uniqueStrings([...strings(previous?.experience), ...experience], 10),
          projects: uniqueStrings([...strings(previous?.projects), ...strings(item.projects)], 8),
          workProjects: mergeWorkProjects(previous?.workProjects, item.workProjects),
          technologies: normalizeTechnologies(
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
          workProjects: mergeWorkProjects(item.workProjects),
          technologies: normalizeTechnologies(item.technologies, 30),
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
          projectType: text(previous?.projectType, projectType(item)),
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
          technologies: normalizeTechnologies(
            [...strings(previous?.technologies), ...strings(item.technologies)],
            30
          ),
          ...projectLinks({
            ...item,
            url: text(item.url, text(previous?.url)),
            liveUrl: text(item.liveUrl, text(previous?.liveUrl)),
            githubUrl: text(item.githubUrl, text(previous?.githubUrl)),
            videoUrl: text(item.videoUrl, text(previous?.videoUrl)),
            links: [...strings(previous?.links), ...strings(item.links)]
          }),
          process: uniqueStrings([...strings(previous?.process), ...strings(item.process)], 8),
          evidence: uniqueStrings([...strings(previous?.evidence), ...strings(item.evidence)], 12)
        });
      }
      return [...merged.values()].slice(0, 100).map((item) => ({
        id: stableId("project", [text(item.title)]),
        title: text(item.title, "Untitled project"),
        projectType: projectType(item),
        category: projectCategory(item),
        summary: text(item.summary),
        description: text(item.description),
        problem: text(item.problem),
        approach: text(item.approach),
        role: text(item.role),
        outcome: text(item.outcome),
        highlights: uniqueStrings(item.highlights, 12),
        technologies: normalizeTechnologies(item.technologies, 30),
        ...projectLinks(item),
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

  // Shared source documents are provenance, not project ownership. Apply the
  // owner's confirmed placements after synthesis so model retries cannot move
  // these projects between employers or leave them in the personal-project list.
  for (const project of normalized.projects) {
    const placement = projectCareerPlacement(text(project.title));
    if (!placement) continue;
    project.projectType = "professional";
    const experience = normalized.experiences.find((item) =>
      sameCareerIdentity(
        { role: text(item.role), organization: text(item.organization) },
        placement
      )
    );
    if (!experience) continue;
    experience.projects = uniqueStrings([...strings(experience.projects), text(project.title)], 8);
    experience.workProjects = mergeWorkProjects(experience.workProjects, [
      {
        title: text(project.title),
        summary: text(project.summary, text(project.description)),
        outcome: text(project.outcome),
        technologies: strings(project.technologies),
        evidence: strings(project.evidence)
      }
    ]);
  }
  return anonymizePrivateEmployer(normalized) as CareerBrainContent;
}

export function mergeCareerBrainSectionOutputs(
  profile: Record<string, unknown>,
  experience: Record<string, unknown>,
  projects: Record<string, unknown>
): CareerBrainContent {
  return normalizeCareerBrainContent({
    ...profile,
    experiences: experience.experiences,
    projects: projects.projects
  });
}

async function loadInputs(client: SupabaseClient, ownerId: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [facts, documentInputs, journals, applications] = await Promise.all([
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
    loadDocumentCareerInputs(client, ownerId),
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
  for (const result of [facts, journals, applications]) if (result.error) throw result.error;
  // Provider prompts must contain career evidence, not the complete relational
  // response. Compacting here prevents large document libraries from exceeding
  // the orchestrator context or request timeout while retaining provenance.
  const source = {
    facts: compactCanonicalFacts(facts.data),
    extracted: compactSourceAwareExtractedFacts(documentInputs.extracted),
    journals: compactJournals(journals.data),
    recentApplications: compactApplications(applications.data)
  };
  return {
    source,
    coverageEvidence: documentInputs.coverageEvidence,
    sourceHash: createHash("sha256")
      .update(
        JSON.stringify({
          version: CAREER_BRAIN_SYNTHESIS_VERSION,
          source,
          evidenceFingerprint: documentInputs.evidenceFingerprint
        })
      )
      .digest("hex")
  };
}

async function refreshCareerBrainRetrievalCache(
  client: SupabaseClient,
  ownerId: string,
  sourceHash: string,
  serviceMode = false,
  options: { forceFresh?: boolean; coverageEvidence?: RetrievedEvidence[] } = {}
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
          requested_kinds: ["resume", "other"],
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
    18
  );
  const semanticEvidence = forceFresh
    ? rerankedFreshEvidence
    : mergeEvidence(rerankedFreshEvidence, cacheMatchesSource ? (cached?.evidence ?? []) : []);
  const evidence = mergeSourceAwareEvidence(options.coverageEvidence ?? [], semanticEvidence);
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
  const { source, sourceHash, coverageEvidence } = await loadInputs(client, ownerId);
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
      await refreshCareerBrainRetrievalCache(client, ownerId, sourceHash, options.serviceMode, {
        coverageEvidence
      });
    }
    return { snapshot: existingSnapshot, reused: true };
  }

  const { evidence } = await refreshCareerBrainRetrievalCache(
    client,
    ownerId,
    sourceHash,
    options.serviceMode,
    { forceFresh, coverageEvidence }
  );
  const providers = (await resolveReasoningProviders(client, ownerId, "evidence_extraction")).map(
    (provider) => ({
      ...provider,
      timeoutMs: Math.max(provider.timeoutMs, CAREER_BRAIN_TIMEOUT_MS)
    })
  );
  const commonInstructions = [
    EMPLOYER_PRIVACY_INSTRUCTION,
    "You maintain Basil Ogbonna's private Career Brain. Return JSON only and never invent a fact.",
    "Reconcile all supplied CV and knowledge-base evidence. Newly indexed CV excerpts are deliberately included alongside semantic matches, so do not ignore a source merely because it is newer.",
    "Cover letters are intentionally excluded because tailored application wording is not an authoritative career record.",
    "Use recentApplicationFocus only to rank verified details for the roles Basil is pursuing; never treat a job description as evidence that Basil did something.",
    "Write like a thoughtful senior engineer speaking plainly: specific, natural, confident and grounded in real work. Avoid keyword stuffing, corporate clichés, empty proof language and repetitive AI-style phrasing.",
    "Prioritize supported data-engineering and data-platform work, including pipelines, warehouses, modelling, orchestration, quality, governance, reliability, scale and delivery tools, while retaining relevant software and AI work.",
    "Do not include the Software Engineer (Backend) role at One Acre Fund in the experience output. Exclude that role entirely, including its title, organization label, and role-specific summary; retain only other supported roles and transferable technical evidence.",
    "Preserve dates, metrics, scope, technical names and source labels when present. Omit uncertain claims rather than guessing."
  ].join(" ");
  const profileFacts = records(source.facts).filter((item) => item.type !== "project");
  const experienceFacts = records(source.facts).filter((item) => item.type === "experience");
  const projectFacts = records(source.facts).filter((item) => item.type === "project");
  const [profileGeneration, experienceGeneration, projectGeneration] = await Promise.all([
    generateReasoningJson(
      providers,
      `${commonInstructions} Focus only on the profile and credentials. Produce a concise professional cvSummary, a warm first-person portfolioSummary, a distinct first-person about narrative, complete supported education and certifications, and grouped technicalSkills. Draw descriptors from the supplied professional summaries instead of using generic labels. Do not return experiences or projects.`,
      {
        semanticEvidence: focusedEvidence(
          evidence,
          /\b(profile|summary|skill|technology|tool|education|degree|university|certif|credential|course|leadership)\b/i,
          12
        ),
        canonicalPrivateFacts: boundedRecords(profileFacts, 260, 36_000),
        extractedPrivateFacts: focusedExtractedFacts(
          source.extracted,
          /\b(profile|summary|skill|technology|tool|education|degree|university|certif|credential|course|leadership)\b/i,
          180,
          24_000
        ),
        recentApplicationFocus: source.recentApplications
      },
      { task: "career_profile_synthesis" }
    ),
    generateReasoningJson(
      providers,
      `${commonInstructions} Focus only on career experience. The CV evidence is grouped by source: no individual CV is authoritative and no retry may select one CV as the winner. For each exact role and organization, reconcile the union of supported details across every supplied CV, remove duplicates, resolve wording variants, and produce one stable consolidated role summary. Return no more than 10 detailed experience entries per role, combining responsibility, action, scope, achievement, impact and outcome into natural complete sentences when supported. Populate workProjects with 2-6 substantial initiatives delivered during that role whenever the evidence supports them. A work project needs a concise title, what was built or changed, its outcome, technologies, and source labels. When an initiative has no formal product name, use a factual descriptive title derived from the evidence; never invent a brand or unsupported result. Normalize the Bloom Institute of Technology role to exactly Lead Software Engineer with the period November 2019 – April 2020. Assign Lambdadoor only to that Bloom role. Assign Climate Change only to the Data Engineer role at One Acre Fund. Assign WhereToCode only to the Software Engineer role at Andela. Lambdadoor, Climate Change, and WhereToCode are professional projects, not personal projects. Shared CV source labels never prove that a project belongs to every role in that CV. Also keep the legacy projects field as the list of work-project titles. Include all contributing CV names in evidence. Do not return profile, education, certifications, skills groups or standalone personal projects.`,
      {
        semanticEvidence: focusedEvidence(
          evidence,
          /\b(experience|employment|engineer|developer|lead|built|designed|delivered|managed|migrated|improved|impact|outcome|pipeline|warehouse|platform)\b/i,
          16
        ),
        canonicalPrivateFacts: boundedRecords(experienceFacts, 300, 38_000),
        cvEvidenceBySource: extractedFactsBySource(
          source.extracted,
          /\b(experience|employment|engineer|developer|lead|built|designed|delivered|managed|migrated|improved|impact|outcome|project|initiative|system|service|pipeline|warehouse|platform|payment|analytics|reporting)\b/i
        ),
        recentApplicationFocus: source.recentApplications
      },
      { task: "career_experience_synthesis" }
    ),
    generateReasoningJson(
      providers,
      `${commonInstructions} Focus on every distinct supported project that could be selected for the portfolio, including professional, personal, and open-source work. Do not discard a project merely because it belongs to an employer role. Include every distinct supported project rather than only the most prominent examples, but merge duplicate descriptions of the same project. For each project provide a substantive summary and description, problem, approach, Basil's role, supported outcome, highlights, exact technologies, known links, 4-8 meaningful engineering process steps, concise source labels, and projectType set to exactly Personal, Open source, Professional, or Unknown. Always write the PostgreSQL, Express.js, React.js, and Node.js stack using those four full technology names. Lambdadoor, Climate Change, and WhereToCode are professional projects, not personal projects. Copy every supplied GitHub, YouTube, live-project, or other external URL exactly into the appropriate githubUrl, videoUrl, liveUrl, url, or links field; never invent or drop a supplied link. Assign exactly one category from Software, Data, or AI. Do not return profile or experience sections.`,
      {
        semanticEvidence: focusedEvidence(
          evidence,
          /\b(project|system|application|platform|pipeline|architecture|prototype|product|solution|github|software|data|machine learning|AI|RAG)\b/i,
          16
        ),
        canonicalPrivateFacts: boundedRecords(projectFacts, 300, 40_000),
        extractedPrivateFacts: focusedExtractedFacts(
          source.extracted,
          /\b(project|system|application|platform|pipeline|architecture|prototype|product|solution|github|software|data|machine learning|AI|RAG)\b/i,
          240,
          32_000
        ),
        recentApplicationFocus: source.recentApplications
      },
      { task: "career_project_synthesis" }
    )
  ]);
  const generations = [profileGeneration, experienceGeneration, projectGeneration];
  const content = mergeCareerBrainSectionOutputs(
    profileGeneration.output,
    experienceGeneration.output,
    projectGeneration.output
  );
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
      provider: [...new Set(generations.map((item) => item.provider.provider))].join(","),
      model: [...new Set(generations.map((item) => item.provider.model))].join(","),
      model_version: [
        ...new Set(generations.map((item) => item.provider.model_version).filter(Boolean))
      ].join(","),
      input_hash: createHash("sha256")
        .update(generations.map((item) => item.inputHash).join(":"))
        .digest("hex"),
      output_hash: createHash("sha256").update(JSON.stringify(content)).digest("hex")
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
