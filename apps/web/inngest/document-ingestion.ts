import { createHash, createHmac } from "node:crypto";
import { createServiceSupabaseClient } from "@career-os/database/service";
import { classifyCareerDocument } from "@/lib/document-classification";
import {
  embedWithFallback,
  embedWithProvider,
  PRODUCTION_EMBEDDING_DIMENSIONS,
  resolveEmbeddingProviders,
  type ResolvedEmbeddingProvider
} from "@/lib/server/embedding-provider";
import { inngest } from "./client";
import { requestCareerBrainRefresh } from "./career-brain-events";

interface ParserChunk {
  ordinal: number;
  content: string;
  contentHash: string;
  charStart: number;
  charEnd: number;
  pageStart: number | null;
  pageEnd: number | null;
  sectionPath: string[];
}

interface ParserCandidate {
  factType: string;
  statement: string;
  confidence: number;
  sourceStart: number;
  sourceEnd: number;
  section?: string | null;
  structuredValue?: Record<string, unknown>;
}

interface ParserResult {
  status: "completed" | "quarantined";
  parser?: string;
  parserVersion?: string;
  code?: string;
  chunks?: ParserChunk[];
  candidates?: ParserCandidate[];
}

function configuredClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createServiceSupabaseClient(url, key) : null;
}

function parserConfiguration() {
  const development = process.env.NODE_ENV !== "production";
  const url = (
    process.env.CAREER_WORKER_URL ?? (development ? "http://127.0.0.1:8081" : "")
  ).replace(/\/$/, "");
  const secret =
    process.env.CAREER_WORKER_SHARED_SECRET ??
    (development
      ? createHash("sha256").update("career-worker-local-development").digest("hex")
      : "");
  return url && secret ? { url, secret } : null;
}

function ingestionErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "DOCUMENT_INGESTION_FAILED";
  return message
    .replace(/(secret|token|password|api[_-]?key)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .slice(0, 500);
}

function isParserResult(value: unknown): value is ParserResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  if (result.status === "quarantined") return typeof result.code === "string";
  if (result.status !== "completed" || !Array.isArray(result.chunks)) return false;
  const chunks = result.chunks;
  const validChunks = chunks.every((chunk) => {
    if (!chunk || typeof chunk !== "object") return false;
    const item = chunk as Record<string, unknown>;
    return (
      Number.isInteger(item.ordinal) &&
      typeof item.content === "string" &&
      item.content.trim().length > 0 &&
      item.content.length <= 20_000 &&
      typeof item.contentHash === "string" &&
      Number.isInteger(item.charStart) &&
      Number.isInteger(item.charEnd) &&
      Number(item.charStart) >= 0 &&
      Number(item.charEnd) > Number(item.charStart) &&
      (item.pageStart === null ||
        (Number.isInteger(item.pageStart) && Number(item.pageStart) > 0)) &&
      (item.pageEnd === null || (Number.isInteger(item.pageEnd) && Number(item.pageEnd) > 0)) &&
      (item.pageStart === null ||
        item.pageEnd === null ||
        Number(item.pageEnd) >= Number(item.pageStart)) &&
      Array.isArray(item.sectionPath) &&
      item.sectionPath.every((section) => typeof section === "string")
    );
  });
  if (!validChunks) return false;
  const typedChunks = chunks as ParserChunk[];
  return typedChunks.every((chunk, index) => {
    const previous = typedChunks[index - 1];
    return (
      chunk.ordinal === index &&
      (index === 0 || (previous !== undefined && chunk.charStart > previous.charStart))
    );
  });
}

export const documentIngestion = inngest.createFunction(
  {
    id: "document-ingestion",
    retries: 2,
    concurrency: [{ limit: 2, key: "event.data.ownerId" }],
    triggers: [{ event: "career/document.changed.v1" }]
  },
  async ({ event, step }) => {
    const ownerId = typeof event.data.ownerId === "string" ? event.data.ownerId : null;
    const documentId = typeof event.data.resourceId === "string" ? event.data.resourceId : null;
    const metadata =
      event.data.metadata && typeof event.data.metadata === "object"
        ? (event.data.metadata as Record<string, unknown>)
        : {};
    const documentVersionId =
      typeof metadata.documentVersionId === "string" ? metadata.documentVersionId : null;
    const client = configuredClient();
    const parser = parserConfiguration();
    if (!ownerId || !documentId || !documentVersionId)
      return { status: "failed" as const, reason: "INVALID_DOCUMENT_EVENT" };
    if (!client || !parser) throw new Error("DOCUMENT_WORKER_CONFIGURATION_MISSING");

    return step.run("parse-index-extract", async () => {
      let activeRunId: string | null = null;
      let activeItemId: string | null = null;
      try {
        const { data: document, error: documentError } = await client
          .schema("app")
          .from("documents")
          .select("id,name,source_mime,parent_path,evidence_source_id")
          .eq("id", documentId)
          .eq("owner_id", ownerId)
          .maybeSingle();
        if (documentError || !document) throw documentError ?? new Error("DOCUMENT_NOT_FOUND");
        const { data: version, error: versionError } = await client
          .schema("app")
          .from("document_versions")
          .select("id,internal_sha256,storage_object_path,evidence_version_id")
          .eq("id", documentVersionId)
          .eq("document_id", documentId)
          .maybeSingle();
        if (versionError || !version) throw versionError ?? new Error("DOCUMENT_VERSION_NOT_FOUND");
        const forceExtraction = metadata.forceExtraction === true;
        if (version.evidence_version_id && !forceExtraction)
          return { status: "unchanged" as const, evidenceVersionId: version.evidence_version_id };

        let sourceId = document.evidence_source_id as string | null;
        if (!sourceId) {
          const { data: source, error: sourceError } = await client
            .schema("app")
            .from("evidence_sources")
            .insert({
              owner_id: ownerId,
              source_type: "document",
              title: document.name,
              visibility: "private",
              trust_level: "ai_extracted",
              verification_state: "unverified"
            })
            .select("id")
            .single();
          if (sourceError || !source)
            throw sourceError ?? new Error("EVIDENCE_SOURCE_CREATE_FAILED");
          sourceId = source.id;
          const { error } = await client
            .schema("app")
            .from("documents")
            .update({ evidence_source_id: sourceId })
            .eq("id", documentId)
            .eq("owner_id", ownerId);
          if (error) throw error;
        }

        let runId = typeof metadata.ingestionRunId === "string" ? metadata.ingestionRunId : null;
        if (!runId) {
          const { data: run, error: runError } = await client
            .schema("app")
            .from("ingestion_runs")
            .upsert(
              {
                owner_id: ownerId,
                trigger: "document_upload",
                correlation_id:
                  typeof event.data.correlationId === "string"
                    ? event.data.correlationId
                    : (event.id ?? documentVersionId),
                idempotency_key: `ingest:${documentVersionId}`,
                status: "running",
                started_at: new Date().toISOString()
              },
              { onConflict: "owner_id,idempotency_key" }
            )
            .select("id")
            .single();
          if (runError || !run) throw runError ?? new Error("INGESTION_RUN_CREATE_FAILED");
          runId = run.id;
        }
        activeRunId = runId;
        const { data: item, error: itemError } = await client
          .schema("app")
          .from("ingestion_items")
          .upsert(
            {
              run_id: runId,
              document_id: documentId,
              document_version_id: documentVersionId,
              stage: "parsing",
              status: "running",
              attempts: 1,
              started_at: new Date().toISOString()
            },
            { onConflict: "run_id,document_id,document_version_id" }
          )
          .select("id")
          .single();
        if (itemError || !item) throw itemError ?? new Error("INGESTION_ITEM_CREATE_FAILED");
        activeItemId = item.id;

        const objectPath = (version.storage_object_path as string | null) ?? document.parent_path;
        if (!objectPath) throw new Error("DOCUMENT_OBJECT_PATH_MISSING");
        const { data: blob, error: downloadError } = await client.storage
          .from("private-documents")
          .download(objectPath);
        if (downloadError || !blob) throw downloadError ?? new Error("DOCUMENT_OBJECT_MISSING");
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const response = await fetch(`${parser.url}/parse`, {
          method: "POST",
          headers: {
            "content-type": "application/octet-stream",
            "x-document-media-type": document.source_mime,
            "x-career-signature": createHmac("sha256", parser.secret).update(bytes).digest("hex")
          },
          body: bytes,
          signal: AbortSignal.timeout(45_000)
        });
        const parsed = (await response.json().catch(() => null)) as unknown;
        if (!isParserResult(parsed)) throw new Error("DOCUMENT_PARSER_RESPONSE_INVALID");
        const classification = classifyCareerDocument(
          document.name as string,
          (parsed.chunks ?? []).map((chunk) => chunk.content).join("\n")
        );
        const { error: classificationError } = await client
          .schema("app")
          .from("documents")
          .update({
            document_kind: classification.kind,
            classification_confidence: classification.confidence,
            classification_reason: classification.reason
          })
          .eq("id", documentId)
          .eq("owner_id", ownerId);
        if (classificationError) throw classificationError;

        const { data: existingVersion } = await client
          .schema("app")
          .from("evidence_versions")
          .select("id,ordinal")
          .eq("evidence_source_id", sourceId)
          .eq("external_revision", documentVersionId)
          .order("ordinal", { ascending: false })
          .limit(1)
          .maybeSingle();
        let evidenceVersion = existingVersion;
        let evidenceError: unknown = null;
        if (!evidenceVersion) {
          const { data: prior } = await client
            .schema("app")
            .from("evidence_versions")
            .select("id,ordinal")
            .eq("evidence_source_id", sourceId)
            .order("ordinal", { ascending: false })
            .limit(1)
            .maybeSingle();
          const priorOrdinal = typeof prior?.ordinal === "number" ? prior.ordinal : 0;
          const inserted = await client
            .schema("app")
            .from("evidence_versions")
            .insert({
              evidence_source_id: sourceId,
              ordinal: priorOrdinal + 1,
              external_revision: documentVersionId,
              raw_object_key: objectPath,
              raw_sha256: version.internal_sha256,
              normalized_text_sha256: version.internal_sha256,
              media_type: document.source_mime,
              byte_size: bytes.byteLength,
              parser_name: parsed.parser ?? "career-worker",
              parser_version: parsed.parserVersion ?? "1",
              processed_at: new Date().toISOString(),
              quarantine_status: parsed.status === "completed" ? "approved" : "quarantined",
              prior_version_id: prior?.id ?? null
            })
            .select("id,ordinal")
            .single();
          evidenceVersion = inserted.data;
          evidenceError = inserted.error;
        }
        if (evidenceError || !evidenceVersion) {
          const message =
            evidenceError && typeof evidenceError === "object" && "message" in evidenceError
              ? String(evidenceError.message)
              : "EVIDENCE_VERSION_CREATE_FAILED";
          throw new Error(message);
        }

        if (parsed.status === "quarantined") {
          await client
            .schema("app")
            .from("ingestion_items")
            .update({
              stage: "quarantine",
              status: "failed",
              sanitized_error: parsed.code,
              finished_at: new Date().toISOString()
            })
            .eq("id", item.id);
          await client
            .schema("app")
            .from("ingestion_runs")
            .update({
              status: "failed",
              error_summary: parsed.code,
              finished_at: new Date().toISOString()
            })
            .eq("id", runId)
            .eq("owner_id", ownerId);
          return { status: "quarantined" as const, code: parsed.code };
        }

        const chunks = parsed.chunks ?? [];
        const embeddingProviders = await resolveEmbeddingProviders(client, ownerId);
        const embeddedChunks: Array<{
          chunk: ParserChunk;
          vector: number[];
          provider: (typeof embeddingProviders)[number];
        }> = [];
        let selectedEmbeddingProvider: (typeof embeddingProviders)[number] | null = null;
        for (let offset = 0; offset < chunks.length; offset += 64) {
          const batch = chunks.slice(offset, offset + 64);
          const embedded: { provider: ResolvedEmbeddingProvider; vectors: number[][] } =
            selectedEmbeddingProvider
              ? {
                  provider: selectedEmbeddingProvider,
                  vectors: await embedWithProvider(
                    selectedEmbeddingProvider,
                    batch.map((chunk) => chunk.content)
                  )
                }
              : await embedWithFallback(
                  embeddingProviders,
                  batch.map((chunk) => chunk.content)
                );
          selectedEmbeddingProvider = embedded.provider;
          batch.forEach((chunk, index) => {
            const vector = embedded.vectors[index];
            if (!vector) throw new Error("EMBEDDING_PROVIDER_RESPONSE_INVALID");
            embeddedChunks.push({
              chunk,
              vector,
              provider: embedded.provider
            });
          });
        }
        for (const { chunk, vector, provider } of embeddedChunks) {
          const { data: existingChunk, error: existingChunkError } = await client
            .schema("app")
            .from("evidence_chunks")
            .select("id,content_hash")
            .eq("evidence_version_id", evidenceVersion.id)
            .eq("ordinal", chunk.ordinal)
            .maybeSingle();
          if (existingChunkError) throw existingChunkError;
          if (existingChunk && existingChunk.content_hash !== chunk.contentHash)
            throw new Error("EVIDENCE_CHUNK_IMMUTABLE_CONFLICT");
          let persistedChunk = existingChunk;
          if (!persistedChunk) {
            const inserted = await client
              .schema("app")
              .from("evidence_chunks")
              .insert({
                evidence_version_id: evidenceVersion.id,
                ordinal: chunk.ordinal,
                page_start: chunk.pageStart,
                page_end: chunk.pageEnd,
                section_path: chunk.sectionPath,
                char_start: chunk.charStart,
                char_end: chunk.charEnd,
                content: chunk.content,
                content_hash: chunk.contentHash,
                visibility: "private",
                trust_level: "ai_extracted"
              })
              .select("id,content_hash")
              .single();
            if (inserted.error || !inserted.data)
              throw inserted.error ?? new Error("EVIDENCE_CHUNK_CREATE_FAILED");
            persistedChunk = inserted.data;
          }
          const embeddingVersion = `${provider.provider}:${provider.model}:${provider.model_version}`;
          const { data: existingEmbedding, error: existingEmbeddingError } = await client
            .schema("app")
            .from("chunk_embeddings")
            .select("id,input_hash")
            .eq("chunk_id", persistedChunk.id)
            .eq("embedding_version", embeddingVersion)
            .maybeSingle();
          if (existingEmbeddingError) throw existingEmbeddingError;
          if (existingEmbedding && existingEmbedding.input_hash !== chunk.contentHash)
            throw new Error("CHUNK_EMBEDDING_IMMUTABLE_CONFLICT");
          if (!existingEmbedding) {
            const { error: embeddingError } = await client
              .schema("app")
              .from("chunk_embeddings")
              .insert({
                chunk_id: persistedChunk.id,
                provider: provider.provider,
                model: provider.model,
                model_version: provider.model_version,
                dimensions: PRODUCTION_EMBEDDING_DIMENSIONS,
                embedding_version: embeddingVersion,
                embedding: `[${vector.join(",")}]`,
                normalization: "l2",
                input_hash: chunk.contentHash,
                status: "completed"
              });
            if (embeddingError) throw embeddingError;
          }
        }
        const candidates =
          classification.kind === "cover_letter"
            ? []
            : Array.from(
                new Map(
                  (parsed.candidates ?? []).map((candidate) => [
                    `${candidate.factType}:${candidate.statement.trim().toLocaleLowerCase()}`,
                    candidate
                  ])
                ).values()
              );
        if (forceExtraction) {
          const { data: priorItems, error: priorItemsError } = await client
            .schema("app")
            .from("ingestion_items")
            .select("id")
            .eq("document_id", documentId);
          if (priorItemsError) throw priorItemsError;
          const priorItemIds = (priorItems ?? [])
            .map((priorItem) => priorItem.id as string)
            .filter((priorItemId) => priorItemId !== item.id);
          if (priorItemIds.length) {
            const { error: staleCandidateError } = await client
              .schema("app")
              .from("extracted_facts")
              .update({ review_status: "superseded_reprocess" })
              .in("ingestion_item_id", priorItemIds);
            if (staleCandidateError) throw staleCandidateError;
          }
        }
        if (candidates.length) {
          const { error: candidatesError } = await client
            .schema("app")
            .from("extracted_facts")
            .insert(
              candidates.slice(0, 500).map((candidate) => ({
                ingestion_item_id: item.id,
                original_extraction: candidate,
                statement: candidate.statement,
                subject_candidate: {
                  factType: candidate.factType,
                  section: candidate.section ?? candidate.factType,
                  ...(candidate.structuredValue ?? {})
                },
                confidence: candidate.confidence,
                trust_level: "ai_extracted",
                model_version: "career-structure-extractor.v3",
                prompt_version: "none",
                schema_version: "career-fact-candidate.v3",
                source_offsets: { start: candidate.sourceStart, end: candidate.sourceEnd },
                review_status: "available_private"
              }))
            );
          if (candidatesError) throw candidatesError;
        }
        await client
          .schema("app")
          .from("document_versions")
          .update({ evidence_version_id: evidenceVersion.id })
          .eq("id", documentVersionId)
          .eq("document_id", documentId);
        await client
          .schema("app")
          .from("ingestion_items")
          .update({
            stage: "indexed",
            status: "completed",
            parser_metrics: {
              bytes: bytes.byteLength,
              chunks: chunks.length,
              candidates: candidates.length,
              documentKind: classification.kind,
              classificationConfidence: classification.confidence,
              embeddingProvider: selectedEmbeddingProvider?.provider,
              embeddingModel: selectedEmbeddingProvider?.model
            },
            sanitized_error: null,
            finished_at: new Date().toISOString()
          })
          .eq("id", item.id);
        await client
          .schema("app")
          .from("ingestion_runs")
          .update({ status: "completed", document_count: 1, finished_at: new Date().toISOString() })
          .eq("id", runId)
          .eq("owner_id", ownerId)
          .neq("trigger", "drive");
        await requestCareerBrainRefresh(ownerId, "document", documentVersionId).catch(
          () => undefined
        );
        return {
          status: "completed" as const,
          evidenceVersionId: evidenceVersion.id,
          chunks: chunks.length,
          candidates: candidates.length
        };
      } catch (error) {
        const sanitizedError = ingestionErrorMessage(error);
        if (activeItemId) {
          try {
            await client
              .schema("app")
              .from("ingestion_items")
              .update({
                stage: "failed",
                status: "failed",
                sanitized_error: sanitizedError,
                finished_at: new Date().toISOString()
              })
              .eq("id", activeItemId);
          } catch {
            // Preserve the original ingestion failure if status finalization is unavailable.
          }
        }
        if (activeRunId) {
          try {
            await client
              .schema("app")
              .from("ingestion_runs")
              .update({
                status: "failed",
                error_summary: sanitizedError,
                finished_at: new Date().toISOString()
              })
              .eq("id", activeRunId)
              .eq("owner_id", ownerId);
          } catch {
            // Preserve the original ingestion failure if status finalization is unavailable.
          }
        }
        throw error;
      }
    });
  }
);
