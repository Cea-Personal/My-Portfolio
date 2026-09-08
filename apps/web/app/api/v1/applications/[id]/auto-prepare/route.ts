import { createHash } from "node:crypto";
import { renderPdf } from "@career-os/applications";
import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";
import { generateReasoningJson, resolveReasoningProviders } from "@/lib/server/reasoning-provider";

type Fact = { id: string; fact_type: string; statement: string };

function text(value: unknown, fallback = "", limit = 20_000) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, limit) : fallback;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

/**
 * Prepare the application kit from the selected job and private career data.
 * The owner does not have to write CV/cover-letter content in the workspace;
 * an optional employer-question capture remains available separately.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id: applicationId } = await params;
    const { data: application, error: applicationError } = await client
      .schema("app")
      .from("applications")
      .select(
        "id,job_id,application_profile_id,jobs(canonical_title,canonical_company,current_description,salary_min,salary_max,salary_currency,salary_period)"
      )
      .eq("id", applicationId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (applicationError) throw applicationError;
    if (!application) return apiResponse(null, request, 404);

    const job = one(application.jobs as Record<string, unknown> | Record<string, unknown>[] | null);
    const profileQuery = application.application_profile_id
      ? client
          .schema("app")
          .from("application_profiles")
          .select("*")
          .eq("id", application.application_profile_id)
          .eq("owner_id", ownerId)
          .maybeSingle()
      : client
          .schema("app")
          .from("application_profiles")
          .select("*")
          .eq("owner_id", ownerId)
          .eq("status", "approved")
          .eq("is_default", true)
          .is("archived_at", null)
          .maybeSingle();
    const [profileResult, factsResult, snapshotResult] = await Promise.all([
      profileQuery,
      client
        .schema("app")
        .from("career_facts")
        .select("id,fact_type,current_version_id")
        .eq("owner_id", ownerId)
        .neq("review_status", "rejected")
        .limit(500),
      client
        .schema("app")
        .from("career_brain_snapshots")
        .select("content")
        .eq("owner_id", ownerId)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);
    if (profileResult.error) throw profileResult.error;
    if (factsResult.error) throw factsResult.error;
    if (snapshotResult.error) throw snapshotResult.error;

    const factRows = (factsResult.data ?? []) as Array<{
      id: string;
      fact_type: string;
      current_version_id: string | null;
    }>;
    const versionIds = factRows
      .map((fact) => fact.current_version_id)
      .filter((value): value is string => Boolean(value));
    const versionsResult = versionIds.length
      ? await client
          .schema("app")
          .from("career_fact_versions")
          .select("id,statement")
          .in("id", versionIds)
      : { data: [], error: null };
    if (versionsResult.error) throw versionsResult.error;
    const statements = new Map(
      (versionsResult.data ?? []).map((version) => [version.id, text(version.statement)])
    );
    const facts: Fact[] = factRows.flatMap((fact) => {
      const statement = fact.current_version_id ? statements.get(fact.current_version_id) : "";
      return statement ? [{ id: fact.id, fact_type: fact.fact_type, statement }] : [];
    });
    const description = text(job?.current_description);
    if (!description) {
      return apiResponse(
        { code: "JOB_DESCRIPTION_REQUIRED", detail: "This job has no description to prepare against." },
        request,
        422
      );
    }

    const { data: documents, error: documentsError } = await client
      .schema("app")
      .from("documents")
      .select("id,name,document_kind,evidence_source_id")
      .eq("owner_id", ownerId)
      .is("removed_at", null);
    if (documentsError) throw documentsError;
    const sourceIds = (documents ?? [])
      .map((document) => document.evidence_source_id as string | null)
      .filter((value): value is string => Boolean(value));
    const sourcesResult = sourceIds.length
      ? await client
          .schema("app")
          .from("evidence_sources")
          .select("id,evidence_versions(evidence_chunks(content,visibility,deleted_at))")
          .in("id", sourceIds)
      : { data: [], error: null };
    if (sourcesResult.error) throw sourcesResult.error;
    const sourcesById = new Map(
      (sourcesResult.data ?? []).map((source) => [String(source.id), source] as const)
    );
    const privateDocuments = (documents ?? []).flatMap((document) => {
      const name = text(document.name, "Private document", 300);
      const kind = text(document.document_kind).toLowerCase();
      if (kind !== "resume" && kind !== "cover_letter" && !/cv|resume|cover.?letter|curriculum vitae/i.test(name)) return [];
      const source = document.evidence_source_id
        ? (sourcesById.get(String(document.evidence_source_id)) as Record<string, unknown> | undefined)
        : undefined;
      const versions = Array.isArray(source?.evidence_versions) ? source.evidence_versions : [];
      const chunks = versions.flatMap((version) => {
        const row = version as Record<string, unknown>;
        return Array.isArray(row.evidence_chunks) ? row.evidence_chunks : [];
      });
      const content = chunks
        .filter((chunk) => {
          const row = chunk as Record<string, unknown>;
          return typeof row.content === "string" && row.deleted_at == null && row.visibility !== "public";
        })
        .map((chunk) => text((chunk as Record<string, unknown>).content, "", 2_500))
        .filter(Boolean)
        .slice(0, 10)
        .join("\n\n");
      return content ? [{ id: String(document.id), name, content }] : [];
    });

    let generated: Awaited<ReturnType<typeof generateReasoningJson>>;
    try {
      const providers = await resolveReasoningProviders(client, ownerId, "document_composition");
      generated = await generateReasoningJson(
        providers,
        `You are Basil Ogbonna's application writer. Return JSON only with a documents array containing exactly one resume and one cover_letter document. Tailor both to the supplied job description. Use only supplied profile, career facts, CV/cover-letter excerpts, and career snapshot; never invent employers, dates, technologies, metrics, education, authorization, sponsorship, or salary. Keep the CV concise and ATS-readable. Make the cover letter specific to the company and role. Each document must contain artifactType, title, content (plain text with headings and bullets), and evidenceIds containing only supplied career fact IDs when applicable. Private CV and cover-letter excerpts are also valid grounding even when no Career Brain fact IDs exist. If evidence is insufficient, say so in content instead of fabricating it.`,
        {
          job: {
            title: text(job?.canonical_title, "Selected role", 300),
            company: text(job?.canonical_company, "Employer", 300),
            description,
            salary: {
              min: job?.salary_min,
              max: job?.salary_max,
              currency: job?.salary_currency,
              period: job?.salary_period
            }
          },
          applicationProfile: profileResult.data ?? null,
          careerFacts: facts,
          careerBrain: text(snapshotResult.data?.content, "", 20_000),
          privateDocuments,
          applicationId
        },
        { task: "document_composition" }
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message.slice(0, 500) : "APPLICATION_WRITER_FAILED";
      return apiResponse(
        { code: "APPLICATION_KIT_GENERATION_FAILED", detail },
        request,
        422
      );
    }

    const candidates = Array.isArray(generated.output.documents)
      ? generated.output.documents
      : [];
    const validFactIds = new Set(facts.map((fact) => fact.id));
    const documentsToSave = candidates.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const row = value as Record<string, unknown>;
      const artifactTypeValue = text(row.artifactType).toLowerCase().replace(/[ -]+/g, "_");
      const artifactType =
        artifactTypeValue === "cover_letter" || artifactTypeValue === "coverletter"
          ? "cover_letter"
          : artifactTypeValue === "resume" || artifactTypeValue === "cv" || artifactTypeValue === "curriculum_vitae"
            ? "resume"
            : null;
      const content = text(row.content, "", 40_000);
      if (!artifactType || !content) return [];
      const evidenceIds = Array.isArray(row.evidenceIds)
        ? row.evidenceIds.filter((value): value is string => typeof value === "string" && validFactIds.has(value)).slice(0, 100)
        : [];
      return [{
        artifactType,
        title: text(row.title, artifactType === "resume" ? "Tailored CV" : "Tailored cover letter", 200),
        content,
        evidenceIds
      }];
    });
    if (!documentsToSave.length) {
      return apiResponse(
        { code: "APPLICATION_KIT_EMPTY", detail: "The application writer returned no document content." },
        request,
        422
      );
    }
    const hasGrounding = Boolean(
      facts.length || privateDocuments.length || snapshotResult.data?.content
    );
    if (!hasGrounding) {
      return apiResponse(
        {
          code: "APPLICATION_KIT_SOURCE_REQUIRED",
          detail: "Add or index a CV, cover letter, or Career Brain source before preparing this kit."
        },
        request,
        422
      );
    }

    const saved: Array<{ artifactType: string; artifactId: string; versionId: string }> = [];
    for (const document of documentsToSave) {
      const existing = await client
        .schema("app")
        .from("generated_artifacts")
        .select("id")
        .eq("owner_id", ownerId)
        .eq("application_id", applicationId)
        .eq("artifact_type", document.artifactType)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (existing.error) throw existing.error;
      let artifactId = existing.data?.id as string | undefined;
      if (!artifactId) {
        const artifact = await client.schema("app").from("generated_artifacts").insert({
          owner_id: ownerId,
          application_id: applicationId,
          artifact_type: document.artifactType,
          title: document.title
        }).select("id").single();
        if (artifact.error || !artifact.data) throw artifact.error ?? new Error("ARTIFACT_CREATE_FAILED");
        artifactId = artifact.data.id;
      }
      const previous = await client.schema("app").from("artifact_versions").select("version").eq("artifact_id", artifactId).order("version", { ascending: false }).limit(1).maybeSingle();
      if (previous.error) throw previous.error;
      const version = typeof previous.data?.version === "number" ? previous.data.version + 1 : 1;
      const rendered = renderPdf(document.content, "technical");
      const storageKey = `${ownerId}/${artifactId}/${String(version)}.pdf`;
      const upload = await client.storage.from("private-artifact").upload(storageKey, rendered.bytes, { contentType: "application/pdf", upsert: false });
      if (upload.error) throw upload.error;
      const manifest = {
        artifactType: document.artifactType,
        title: document.title,
        content: document.content,
        generatedBy: generated.provider.model,
        careerFactEvidenceIds: document.evidenceIds,
        privateSourceDocuments: privateDocuments.map((source) => source.name)
      };
      const inserted = await client.schema("app").from("artifact_versions").insert({
        artifact_id: artifactId,
        version,
        status: "draft",
        storage_key: storageKey,
        media_type: "application/pdf",
        binary_hash: rendered.hash,
        content_manifest_hash: createHash("sha256").update(JSON.stringify(manifest)).digest("hex"),
        renderer_version: rendered.rendererVersion,
        evidence_ids: document.evidenceIds,
        structured_content: manifest,
        provenance: { applicationId, jobId: application.job_id, generatedAt: new Date().toISOString(), provider: generated.provider.provider, model: generated.provider.model }
      }).select("id").single();
      if (inserted.error || !inserted.data) throw inserted.error ?? new Error("ARTIFACT_VERSION_CREATE_FAILED");
      if (!artifactId) throw new Error("ARTIFACT_CREATE_FAILED");
      const current = await client.schema("app").from("generated_artifacts").update({ title: document.title, current_version_id: inserted.data.id }).eq("id", artifactId).eq("owner_id", ownerId);
      if (current.error) throw current.error;
      saved.push({ artifactType: document.artifactType, artifactId, versionId: inserted.data.id });
    }
    return apiResponse({ applicationId, status: saved.length ? "ready" : "needs_evidence", generatedCount: saved.length, artifacts: saved, provider: generated.provider.model }, request, 201);
  });
}
