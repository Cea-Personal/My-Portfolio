import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { embedWithFallback, resolveEmbeddingProviders } from "./embedding-provider";
import { generateReasoningJson, resolveReasoningProviders } from "./reasoning-provider";

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
const records = (value: unknown) =>
  Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> => Boolean(item) && typeof item === "object"
      )
    : [];

function stableId(prefix: string, parts: string[]) {
  return `${prefix}:${createHash("sha256").update(parts.join("|").toLowerCase()).digest("hex").slice(0, 20)}`;
}

export function normalizeCareerBrainContent(value: unknown): CareerBrainContent {
  const root = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    cvSummary: text(root.cvSummary),
    portfolioSummary: text(root.portfolioSummary),
    about: text(root.about),
    experiences: records(root.experiences)
      .slice(0, 30)
      .map((item) => {
        const organization = text(item.organization, "Organisation not identified");
        const role = text(item.role, "Role not identified");
        return {
          id: stableId("experience", [organization, role, text(item.period)]),
          organization,
          role,
          period: text(item.period),
          summary: text(item.summary),
          responsibilities: strings(item.responsibilities),
          achievements: strings(item.achievements),
          projects: strings(item.projects),
          technologies: strings(item.technologies)
        };
      }),
    projects: records(root.projects)
      .slice(0, 30)
      .map((item) => {
        const title = text(item.title, "Untitled project");
        return {
          id: stableId("project", [title]),
          title,
          summary: text(item.summary),
          role: text(item.role),
          outcome: text(item.outcome),
          technologies: strings(item.technologies),
          url: text(item.url)
        };
      }),
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
    technicalSkills: records(root.technicalSkills)
      .slice(0, 30)
      .map((item) => {
        const category = text(item.category, "Technical skills");
        return {
          id: stableId("skill", [category]),
          category,
          skills: strings(item.skills),
          summary: text(item.summary)
        };
      })
  };
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
  const source = {
    facts: facts.data ?? [],
    extracted: extracted.data ?? [],
    journals: (journals.data ?? []).map((entry) => ({
      ...entry,
      journal_versions: [...entry.journal_versions]
        .sort((a, b) => Number(b.version) - Number(a.version))
        .slice(0, 1)
    })),
    recentApplications: applications.data ?? []
  };
  return { source, sourceHash: createHash("sha256").update(JSON.stringify(source)).digest("hex") };
}

export async function synthesizeCareerBrain(
  client: SupabaseClient,
  ownerId: string,
  options: { serviceMode?: boolean } = {}
) {
  const { source, sourceHash } = await loadInputs(client, ownerId);
  const existing = await client
    .schema("app")
    .from("career_brain_snapshots")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("source_hash", sourceHash)
    .maybeSingle();
  if (existing.error) throw existing.error;
  const existingSnapshot = existing.data as unknown as Record<string, unknown> | null;
  if (existingSnapshot) return { snapshot: existingSnapshot, reused: true };

  const embeddingProviders = await resolveEmbeddingProviders(client, ownerId);
  const queries = [
    "employment history organisations roles dates responsibilities achievements measurable impact",
    "selected personal and professional software data artificial intelligence projects outcomes",
    "technical skills programming languages platforms tools frameworks data and AI technologies",
    "education certifications credentials courses issuers dates",
    "professional profile strengths leadership working style and portfolio about biography"
  ];
  const embedded = await embedWithFallback(embeddingProviders, queries);
  const retrieved = new Map<string, Record<string, unknown>>();
  for (const vector of embedded.vectors) {
    const result = await client
      .schema("app")
      .rpc(options.serviceMode ? "match_owner_private_evidence" : "match_private_evidence", {
        ...(options.serviceMode ? { requested_owner: ownerId } : {}),
        requested_embedding: `[${vector.join(",")}]`,
        requested_provider: embedded.provider.provider,
        requested_model: embedded.provider.model,
        requested_model_version: embedded.provider.model_version,
        requested_kinds: ["resume", "cover_letter", "other"],
        requested_limit: 20,
        requested_min_similarity: 0.12
      });
    if (result.error) throw result.error;
    for (const item of (result.data ?? []) as Record<string, unknown>[])
      retrieved.set(String(item.chunk_id), item);
  }
  const evidence = [...retrieved.values()].slice(0, 60).map((item) => ({
    id: item.chunk_id,
    source: item.source_title,
    section: item.section_path,
    content: text(item.content).slice(0, 2500),
    similarity: item.similarity
  }));
  const providers = await resolveReasoningProviders(client, ownerId, "evidence_extraction");
  const generation = await generateReasoningJson(
    providers,
    `You maintain Basil Ogbonna's private Career Brain. Return JSON only. Synthesize, deduplicate and reconcile the supplied evidence without inventing facts. Recent applications affect ordering and emphasis only; they are not evidence of Basil's experience. Output: cvSummary (concise CV profile), portfolioSummary (human first-person portfolio profile), about (first-person About narrative), experiences[], projects[], education[], certifications[], technicalSkills[]. Each experience must represent one role at one organization and contain organization, role, period, summary, responsibilities[], achievements[] (include impact here), projects[], technologies[]. Projects contain title, summary, role, outcome, technologies[], url. Education contains qualification, institution, period, summary. Certifications contain name, issuer, date, summary. technicalSkills groups contain category, skills[], summary. Prefer corroborated specifics; omit uncertain entries rather than guessing.`,
    {
      semanticEvidence: evidence,
      canonicalPrivateFacts: source.facts,
      extractedPrivateFacts: source.extracted,
      journalEvidence: source.journals,
      recentApplicationFocus: source.recentApplications
    }
  );
  const content = normalizeCareerBrainContent(generation.output);
  const insert = await client
    .schema("app")
    .from("career_brain_snapshots")
    .insert({
      owner_id: ownerId,
      source_hash: sourceHash,
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
  if (insert.error || !insert.data) throw insert.error ?? new Error("CAREER_BRAIN_SAVE_FAILED");
  const snapshot = insert.data as unknown as Record<string, unknown>;
  return { snapshot, reused: false };
}
