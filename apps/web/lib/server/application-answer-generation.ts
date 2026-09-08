import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { embedWithFallback, resolveEmbeddingProviders } from "./embedding-provider";
import { generateReasoningJson, resolveReasoningProviders } from "./reasoning-provider";

type ApplicationField = {
  id: string;
  label: string;
  field_type: string;
  required: boolean;
  choices: unknown;
  char_limit: number | null;
  word_limit: number | null;
  category: string | null;
  sensitive: boolean;
};

type Evidence = { id: string; source?: string; content: string };

const stringValue = (value: unknown, fallback = "") =>
  typeof value === "string" ? value.trim().slice(0, 20_000) : fallback;

function profileValue(
  profile: Record<string, unknown> | null,
  field: Pick<ApplicationField, "label" | "category">
): string {
  if (!profile) return "";
  const section = (key: string) => {
    const value = profile[key];
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  };
  const identity = section("identity");
  const contact = section("contact");
  const links = section("links");
  const location = section("location");
  const authorization = section("work_authorization");
  const availability = section("availability");
  const languages = profile.languages;
  const label = field.label.toLowerCase();
  const category = (field.category ?? "").toLowerCase();
  const candidate = label.includes("email")
    ? contact.email
    : label.includes("phone")
      ? contact.phone
      : label.includes("linkedin")
        ? links.linkedin
        : label.includes("portfolio") || label.includes("website")
          ? links.portfolio
          : label.includes("sponsor") || label.includes("visa")
            ? authorization.sponsorship
            : label.includes("notice") ||
                label.includes("availability") ||
                label.includes("start date")
              ? availability.notice
              : label.includes("relocat")
                ? location.relocation
                : label.includes("name") || category === "identity"
                  ? identity.fullName
                  : category === "location"
                    ? location.current
                    : category === "work authorization"
                      ? authorization.summary
                      : category === "availability"
                        ? availability.notice
                        : category === "links"
                          ? links.portfolio
                          : category === "contact"
                            ? contact.email
                            : category === "languages"
                              ? languages
                              : undefined;
  return Array.isArray(candidate)
    ? candidate.filter((item): item is string => typeof item === "string").join(", ")
    : stringValue(candidate);
}

/**
 * These values are never safe to infer from a CV or an LLM response. The
 * profile must contain an explicit owner-provided value before we fill them.
 */
function explicitOnlyField(field: Pick<ApplicationField, "label" | "category" | "sensitive">) {
  const text = `${field.label} ${field.category ?? ""}`.toLowerCase();
  return (
    field.sensitive ||
    /authorization|sponsorship|visa|work permit|right to work|notice period|availability|start date|relocat|gender|race|ethnic|disab|demographic|veteran|age/.test(
      text
    )
  );
}

function wordCount(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function withinLimits(field: ApplicationField, value: string): boolean {
  return (
    (!field.char_limit || value.length <= field.char_limit) &&
    (!field.word_limit || wordCount(value) <= field.word_limit)
  );
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function retrieveEvidence(
  client: SupabaseClient,
  ownerId: string,
  query: string
): Promise<Evidence[]> {
  try {
    const providers = await resolveEmbeddingProviders(client, ownerId);
    const embedded = await embedWithFallback(providers, [query]);
    const vector = embedded.vectors[0];
    if (!vector) return [];
    const result = await client.schema("app").rpc("match_private_evidence", {
      requested_embedding: `[${vector.join(",")}]`,
      requested_provider: embedded.provider.provider,
      requested_model: embedded.provider.model,
      requested_model_version: embedded.provider.model_version,
      requested_kinds: ["resume", "cover_letter", "other"],
      requested_limit: 24,
      requested_min_similarity: 0.12
    });
    if (result.error) return [];
    const rows: unknown[] = Array.isArray(result.data) ? (result.data as unknown[]) : [];
    return rows.flatMap((item: unknown) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      const id = stringValue(row.chunk_id);
      const content = stringValue(row.content);
      if (!id || !content) return [];
      const source = stringValue(row.source_title);
      return [{ id, content: content.slice(0, 2400), ...(source ? { source } : {}) }];
    });
  } catch {
    return [];
  }
}

/**
 * Keep answer generation useful when a newly uploaded CV has not completed
 * embedding yet. Semantic matches remain preferred; this private excerpt
 * fallback is deliberately limited to resume/cover-letter source chunks.
 */
async function retrieveDirectDocumentEvidence(
  client: SupabaseClient,
  ownerId: string
): Promise<Evidence[]> {
  try {
    const documentsResult = await client
      .schema("app")
      .from("documents")
      .select("id,name,document_kind,evidence_source_id")
      .eq("owner_id", ownerId)
      .is("removed_at", null);
    if (documentsResult.error) return [];
    const documents = Array.isArray(documentsResult.data) ? (documentsResult.data as unknown[]) : [];
    const sourceIds = documents.flatMap((rawDocument) => {
      if (!rawDocument || typeof rawDocument !== "object") return [];
      const sourceId = (rawDocument as Record<string, unknown>).evidence_source_id;
      return typeof sourceId === "string" ? [sourceId] : [];
    });
    if (!sourceIds.length) return [];
    const sourcesResult = await client
      .schema("app")
      .from("evidence_sources")
      .select("id,evidence_versions(evidence_chunks(id,content,visibility,deleted_at))")
      .in("id", sourceIds);
    if (sourcesResult.error) return [];
    const sourcesById = new Map(
      sourcesResult.data.map((source) => [String(source.id), source] as const)
    );
    return documents.flatMap((rawDocument) => {
      if (!rawDocument || typeof rawDocument !== "object") return [];
      const document = rawDocument as Record<string, unknown>;
      const name = typeof document.name === "string" ? document.name : "";
      const kind = typeof document.document_kind === "string" ? document.document_kind : "";
      if (kind !== "resume" && kind !== "cover_letter" && !/cv|resume|cover.?letter|curriculum vitae/i.test(name)) return [];
      const sourceId = document.evidence_source_id;
      const source = typeof sourceId === "string" ? sourcesById.get(sourceId) : undefined;
      if (!source || typeof source !== "object") return [];
      const versionsValue = (source as Record<string, unknown>).evidence_versions;
      const versions = Array.isArray(versionsValue) ? versionsValue : [];
      return versions.flatMap((rawVersion) => {
        if (!rawVersion || typeof rawVersion !== "object") return [];
        const version = rawVersion as Record<string, unknown>;
        const chunksValue = version.evidence_chunks;
        const chunks = Array.isArray(chunksValue) ? chunksValue : [];
        return chunks.flatMap((rawChunk) => {
          if (!rawChunk || typeof rawChunk !== "object") return [];
          const chunk = rawChunk as Record<string, unknown>;
          if (
            typeof chunk.id !== "string" ||
            typeof chunk.content !== "string" ||
            chunk.deleted_at != null ||
            chunk.visibility === "public"
          ) return [];
          return [
            {
              id: chunk.id,
              source: name || "Private CV source",
              content: chunk.content.slice(0, 2400)
            }
          ];
        });
      });
    }).slice(0, 24);
  } catch {
    return [];
  }
}

export interface ApplicationAnswerGenerationResult {
  status: "generated" | "partial" | "unavailable" | "empty";
  generatedCount: number;
  needsOwnerInput: number;
  evidenceCount: number;
  error?: string;
}

export async function generateApplicationAnswers(
  client: SupabaseClient,
  ownerId: string,
  applicationId: string
): Promise<ApplicationAnswerGenerationResult> {
  const applicationResult = await client
    .schema("app")
    .from("applications")
    .select(
      "id,job_id,application_profile_id,jobs(canonical_title,canonical_company,current_description,salary_min,salary_max,salary_currency,salary_period,discovery_profile_id)"
    )
    .eq("id", applicationId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (applicationResult.error) throw applicationResult.error;
  if (!applicationResult.data) throw new Error("APPLICATION_NOT_FOUND");
  const application = applicationResult.data as unknown as {
    job_id: string;
    application_profile_id: string | null;
    jobs: unknown;
  };

  const formsResult = await client
    .schema("app")
    .from("application_forms")
    .select("application_fields(*)")
    .eq("application_id", applicationId);
  if (formsResult.error) throw formsResult.error;
  const formRows: unknown[] = Array.isArray(formsResult.data)
    ? (formsResult.data as unknown[])
    : [];
  const fields = formRows.flatMap((form) => {
    if (!form || typeof form !== "object") return [];
    const rawFields = (form as Record<string, unknown>).application_fields;
    return (Array.isArray(rawFields) ? rawFields : []).flatMap((field) =>
      field && typeof field === "object" ? [field as ApplicationField] : []
    );
  });
  if (!fields.length)
    return { status: "empty", generatedCount: 0, needsOwnerInput: 0, evidenceCount: 0 };

  const profileResult = application.application_profile_id
    ? await client
        .schema("app")
        .from("application_profiles")
        .select("*")
        .eq("id", application.application_profile_id)
        .eq("owner_id", ownerId)
        .maybeSingle()
    : await client
        .schema("app")
        .from("application_profiles")
        .select("*")
        .eq("owner_id", ownerId)
        .eq("status", "approved")
        .eq("is_default", true)
        .maybeSingle();
  if (profileResult.error) throw profileResult.error;
  const profile = (profileResult.data ?? null) as Record<string, unknown> | null;
  const rawJob = application.jobs;
  const job = (Array.isArray(rawJob) ? rawJob[0] : rawJob) as Record<string, unknown> | null;
  const jobRecord = job ?? {};

  const [factsResult, snapshotResult] = await Promise.all([
    client
      .schema("app")
      .from("career_facts")
      .select(
        "id,fact_type,review_status,verified_by_owner,currentVersion:career_fact_versions!career_facts_current_version_fk(statement,structured_value)"
      )
      .eq("owner_id", ownerId)
      .neq("review_status", "rejected")
      .limit(1_000),
    client
      .schema("app")
      .from("career_brain_snapshots")
      .select("content,generated_at")
      .eq("owner_id", ownerId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);
  if (factsResult.error) throw factsResult.error;
  if (snapshotResult.error) throw snapshotResult.error;

  const fieldContext = fields.map((field) => ({
    id: field.id,
    question: field.label,
    type: field.field_type,
    category: field.category,
    required: field.required,
    sensitive: field.sensitive,
    choices: field.choices,
    charLimit: field.char_limit,
    wordLimit: field.word_limit,
    explicitProfileValue: profileValue(profile, field) || null
  }));
  const jobContext = {
    title: stringValue(jobRecord.canonical_title),
    company: stringValue(jobRecord.canonical_company),
    description: stringValue(jobRecord.current_description).slice(0, 20_000),
    salary: {
      min: jobRecord.salary_min,
      max: jobRecord.salary_max,
      currency: jobRecord.salary_currency,
      period: jobRecord.salary_period
    }
  };
  const discoveryProfileId = stringValue(jobRecord.discovery_profile_id);
  let searchProfile: Record<string, unknown> | null = null;
  if (discoveryProfileId) {
    const searchProfileResult = await client
      .schema("app")
      .from("job_search_profiles")
      .select("minimum_salary,preferred_salary,salary_currency,visa_sponsorship")
      .eq("id", discoveryProfileId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (searchProfileResult.error) throw searchProfileResult.error;
    searchProfile = (searchProfileResult.data ?? null) as Record<string, unknown> | null;
  }
  const semanticEvidence = await retrieveEvidence(
    client,
    ownerId,
    `${jobContext.title} ${jobContext.company} ${jobContext.description} ${fields.map((field) => field.label).join(" ")}`
  );
  const directEvidence = await retrieveDirectDocumentEvidence(client, ownerId);
  const evidence = [...semanticEvidence, ...directEvidence.filter(
    (candidate) => !semanticEvidence.some((item) => item.id === candidate.id)
  )].slice(0, 32);
  const evidenceContext = evidence.map((item) => ({
    id: item.id,
    source: item.source,
    content: item.content
  }));
  // Include the materials explicitly selected/attached to this application in
  // the orchestration context. Uploaded CVs and cover letters are usually
  // represented as private evidence; generated artifacts may still have their
  // structured text available directly on the application.
  const [documentsResult, artifactsResult] = await Promise.all([
    client
      .schema("app")
      .from("application_documents")
      .select("document_kind,original_filename,source_type,availability")
      .eq("application_id", applicationId)
      .eq("owner_id", ownerId)
      .in("document_kind", ["resume", "cover_letter"]),
    client
      .schema("app")
      .from("generated_artifacts")
      .select("artifact_type,title,artifact_versions(status,structured_content)")
      .eq("application_id", applicationId)
      .in("artifact_type", ["resume", "cover_letter"])
  ]);
  if (documentsResult.error) throw documentsResult.error;
  if (artifactsResult.error) throw artifactsResult.error;
  type AttachedDocument = {
    document_kind: string;
    original_filename: string | null;
    source_type: string;
    availability: string;
  };
  type ArtifactVersionMaterial = {
    status: string;
    structured_content: unknown;
  };
  type GeneratedArtifactMaterial = {
    artifact_type: string;
    title: string;
    artifact_versions: ArtifactVersionMaterial[];
  };
  const documentRows: AttachedDocument[] = Array.isArray(documentsResult.data)
    ? (documentsResult.data as AttachedDocument[])
    : [];
  const artifactRows: GeneratedArtifactMaterial[] = Array.isArray(artifactsResult.data)
    ? (artifactsResult.data as GeneratedArtifactMaterial[])
    : [];
  const selectedMaterials = [
    ...documentRows.map((document) => ({
      kind: document.document_kind,
      title: document.original_filename ?? document.document_kind,
      source: document.source_type,
      availability: document.availability
    })),
    ...artifactRows.flatMap((artifact) => {
      const versions = artifact.artifact_versions;
      const finalVersion =
        [...versions]
          .reverse()
          .find((version) => version.status === "final" || version.status === "owner_reviewed") ??
        versions.at(-1);
      const structured = finalVersion?.structured_content;
      const content =
        structured && typeof structured === "object" && !Array.isArray(structured)
          ? stringValue((structured as Record<string, unknown>).content).slice(0, 20_000)
          : "";
      return [
        {
          kind: artifact.artifact_type,
          title: artifact.title,
          source: "generated_artifact",
          ...(content ? { content } : {})
        }
      ];
    })
  ];
  const generated = new Map<
    string,
    { answer: string; evidenceIds: string[]; explanation?: string }
  >();
  let generationError: string | undefined;
  const needsModel = fields.some(
    (field) => !explicitOnlyField(field) && !profileValue(profile, field)
  );
  let providerModel: string | undefined;
  let providerVersion: string | undefined;
  if (needsModel) {
    try {
      const providers = await resolveReasoningProviders(client, ownerId, "document_composition");
      providerModel = providers[0]?.model;
      providerVersion = providers[0]?.model_version;
      const response = await generateReasoningJson(
        providers,
        `You generate private job-application answers for Basil Ogbonna. Return JSON only with an answers array. Answer the exact employer questions supplied; do not produce generic application advice. Use only the job, approved profile values, Career Brain, and evidence context. Never invent employers, dates, technologies, metrics, authorization, sponsorship, salary numbers, or achievements. For sensitive, legal, demographic, authorization, sponsorship, and availability fields, return an empty answer unless an explicit profile value is supplied. If evidence is insufficient, return an empty answer and explain that owner input is required. Each answer must include fieldId, answer, evidenceIds (only supplied evidence IDs), and a short explanation. Respect field type, choices, character limits, and word limits. Motivation answers must be specific to the company and role.`,
        {
          applicationId,
          job: jobContext,
          salaryPreferences: searchProfile,
          selectedCvAndCoverLetter: selectedMaterials,
          selectedApplicationProfile: profile,
          careerBrain: snapshotResult.data?.content ?? null,
          verifiedCareerFacts: factsResult.data,
          privateEvidence: evidenceContext,
          applicationFields: fieldContext
        },
        { task: "application_answers" }
      );
      const answers = Array.isArray(response.output.answers) ? response.output.answers : [];
      for (const item of answers) {
        if (!item || typeof item !== "object") continue;
        const row = item as Record<string, unknown>;
        const fieldId = stringValue(row.fieldId);
        const answer = stringValue(row.answer, "");
        const field = fields.find((candidate) => candidate.id === fieldId);
        if (!field || !answer || explicitOnlyField(field) || !withinLimits(field, answer)) continue;
        const evidenceIds = Array.isArray(row.evidenceIds)
          ? row.evidenceIds.filter(
              (value): value is string =>
                typeof value === "string" && evidence.some((item) => item.id === value)
            )
          : [];
        generated.set(fieldId, {
          answer,
          evidenceIds,
          ...(typeof row.explanation === "string"
            ? { explanation: row.explanation.slice(0, 500) }
            : {})
        });
      }
    } catch (error) {
      generationError =
        error instanceof Error ? error.message.slice(0, 240) : "AI_GENERATION_FAILED";
    }
  }

  let generatedCount = 0;
  let needsOwnerInput = 0;
  for (const field of fields) {
    const explicit = profileValue(profile, field);
    const modelAnswer = explicitOnlyField(field) ? undefined : generated.get(field.id);
    const answer = explicit || modelAnswer?.answer || "";
    const status = answer
      ? explicit || modelAnswer
        ? "generated"
        : "needs_owner_input"
      : "needs_owner_input";
    if (status === "needs_owner_input") needsOwnerInput += 1;
    if (status === "generated") generatedCount += 1;
    const generationContext = {
      applicationId,
      jobId: application.job_id,
      questionHash: hash(field.label),
      evidenceIds: explicit ? [] : (modelAnswer?.evidenceIds ?? []),
      profileId: application.application_profile_id,
      generatedBy: explicit ? "approved_application_profile" : "orchestrator",
      explanation: modelAnswer?.explanation ?? null
    };
    const latestResult = await client
      .schema("app")
      .from("application_answer_versions")
      .select("version,draft_text,generation_context")
      .eq("field_id", field.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestResult.error) throw latestResult.error;
    const latest = latestResult.data as {
      version?: number;
      draft_text?: string;
      generation_context?: unknown;
    } | null;
    if (
      latest &&
      latest.draft_text === answer &&
      hash(latest.generation_context ?? null) === hash(generationContext)
    )
      continue;
    const inserted = await client
      .schema("app")
      .from("application_answer_versions")
      .insert({
        field_id: field.id,
        version: typeof latest?.version === "number" ? latest.version + 1 : 1,
        source: explicit ? "profile" : "generated",
        original_question: field.label,
        draft_text: answer,
        final_text: null,
        evidence_ids: explicit ? [] : (modelAnswer?.evidenceIds ?? []),
        generation_context: generationContext,
        prompt_version: "application-answers.v1",
        model_version: providerVersion ?? null,
        owner_edits: {},
        status,
        generation_status: status,
        generation_error:
          status === "needs_owner_input"
            ? field.sensitive
              ? "Explicit owner input is required for this field."
              : (generationError ?? "No grounded answer could be generated.")
            : null,
        generated_at: new Date().toISOString(),
        limit_result: {
          characters: answer.length,
          words: wordCount(answer),
          charLimit: field.char_limit,
          wordLimit: field.word_limit
        },
        content_hash: hash(answer)
      });
    if (inserted.error) throw inserted.error;
  }
  return {
    status: generationError ? (generatedCount ? "partial" : "unavailable") : "generated",
    generatedCount,
    needsOwnerInput,
    evidenceCount: evidence.length,
    ...(generationError ? { error: generationError } : {}),
    ...(providerModel ? { model: providerModel } : {})
  };
}
