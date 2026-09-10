import { createHash } from "node:crypto";
import { createServiceSupabaseClient } from "@career-os/database/service";
import {
  embedWithFallback,
  PRODUCTION_EMBEDDING_DIMENSIONS,
  resolveEmbeddingProviders
} from "@/lib/server/embedding-provider";
import { inngest } from "./client";
import { requestCareerBrainRefresh } from "./career-brain-events";

const MAX_CHUNK_LENGTH = 1_600;

function configuredClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createServiceSupabaseClient(url, key) : null;
}

function chunkJournal(text: string) {
  const chunks: Array<{
    ordinal: number;
    content: string;
    contentHash: string;
    charStart: number;
    charEnd: number;
  }> = [];
  let start = 0;
  let ordinal = 0;
  while (start < text.length) {
    let end = Math.min(start + MAX_CHUNK_LENGTH, text.length);
    if (end < text.length) {
      const boundary = text.lastIndexOf(" ", end);
      if (boundary > start + 400) end = boundary;
    }
    const content = text.slice(start, end).trim();
    const leadingWhitespace = text.slice(start, end).search(/\S/);
    const contentStart = leadingWhitespace < 0 ? start : start + leadingWhitespace;
    const contentEnd = contentStart + content.length;
    if (content) {
      chunks.push({
        ordinal,
        content,
        contentHash: createHash("sha256").update(content).digest("hex"),
        charStart: contentStart,
        charEnd: contentEnd
      });
      ordinal += 1;
    }
    if (end >= text.length) break;
    start = end;
  }
  return chunks;
}

export async function requestJournalKnowledgeIndex(
  ownerId: string,
  entryId: string,
  contentHash: string
) {
  await inngest.send({
    name: "career/journal.knowledge.index.requested.v1",
    id: `journal-knowledge:${entryId}:${contentHash}`,
    data: {
      schemaVersion: 1,
      ownerId,
      resourceType: "journal_entry",
      resourceId: entryId,
      operationKey: `journal-knowledge:${entryId}:${contentHash}`,
      requestedBy: "system",
      metadata: { contentHash }
    }
  });
}

export const journalKnowledgeIndex = inngest.createFunction(
  {
    id: "journal-knowledge-index",
    retries: 2,
    concurrency: [{ limit: 1, key: "event.data.ownerId" }],
    triggers: [{ event: "career/journal.knowledge.index.requested.v1" }]
  },
  async ({ event, step }) => {
    const ownerId = typeof event.data.ownerId === "string" ? event.data.ownerId : null;
    const entryId = typeof event.data.resourceId === "string" ? event.data.resourceId : null;
    const client = configuredClient();
    if (!ownerId || !entryId) throw new Error("JOURNAL_KNOWLEDGE_EVENT_INVALID");
    if (!client) throw new Error("JOURNAL_KNOWLEDGE_CONFIGURATION_MISSING");

    return step.run("index-journal-version", async () => {
      const { data: entry, error: entryError } = await client
        .schema("app")
        .from("journal_entries")
        .select("id,title,entry_date,related_type,related_id,journal_versions(id,version,text,content_hash)")
        .eq("id", entryId)
        .eq("owner_id", ownerId)
        .is("deleted_at", null)
        .maybeSingle();
      if (entryError) throw entryError;
      if (!entry) return { status: "skipped" as const, reason: "JOURNAL_ENTRY_NOT_FOUND" };
      const versions = Array.isArray(entry.journal_versions) ? entry.journal_versions : [];
      const latest = [...versions].sort((a, b) => Number(b.version) - Number(a.version))[0] as
        | { id: string; version: number; text: string; content_hash: string }
        | undefined;
      if (!latest?.text?.trim()) return { status: "skipped" as const, reason: "JOURNAL_TEXT_EMPTY" };
      const chunks = chunkJournal(latest.text.trim());
      if (!chunks.length) return { status: "skipped" as const, reason: "JOURNAL_TEXT_EMPTY" };
      // Resolve and call the configured production embedding provider before
      // writing immutable evidence rows. A missing provider therefore cannot
      // leave an unembeddable journal version that a retry would skip.
      const providers = await resolveEmbeddingProviders(client, ownerId);
      const embedded = await embedWithFallback(providers, chunks.map((chunk) => chunk.content));
      const embeddingVersion = `${embedded.provider.provider}:${embedded.provider.model}:${embedded.provider.model_version}`;

      // Each immutable journal version gets its own evidence source. This
      // lets us retire an older version without mutating append-only chunks.
      const canonicalUri = `journal:${entryId}:${latest.content_hash}`;
      let source = await client
        .schema("app")
        .from("evidence_sources")
        .select("id")
        .eq("owner_id", ownerId)
        .eq("canonical_uri", canonicalUri)
        .maybeSingle();
      if (source.error) throw source.error;
      if (!source.data) {
        source = await client
          .schema("app")
          .from("evidence_sources")
          .insert({
            owner_id: ownerId,
            source_type: "journal",
            title: String(entry.title ?? "Journal entry").slice(0, 240),
            canonical_uri: canonicalUri,
            author: "Basil Ogbonna",
            visibility: "private",
            trust_level: "owner_verified",
            verification_state: "verified"
          })
          .select("id")
          .single();
        if (source.error || !source.data)
          throw source.error ?? new Error("JOURNAL_EVIDENCE_SOURCE_CREATE_FAILED");
      }
      const sourceId = source.data.id as string;
      const existing = await client
        .schema("app")
        .from("evidence_versions")
        .select("id")
        .eq("evidence_source_id", sourceId)
        .eq("external_revision", latest.content_hash)
        .maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) return { status: "unchanged" as const, evidenceVersionId: existing.data.id };

      const priorSource = await client
        .schema("app")
        .from("evidence_sources")
        .select("id")
        .eq("owner_id", ownerId)
        .eq("source_type", "journal")
        .like("canonical_uri", `journal:${entryId}:%`)
        .neq("canonical_uri", canonicalUri)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (priorSource.error) throw priorSource.error;
      const prior = priorSource.data
        ? await client
            .schema("app")
            .from("evidence_versions")
            .select("id")
            .eq("evidence_source_id", priorSource.data.id)
            .order("ordinal", { ascending: false })
            .limit(1)
            .maybeSingle()
        : { data: null, error: null };
      if (prior.error) throw prior.error;
      const insertedVersion = await client
        .schema("app")
        .from("evidence_versions")
        .insert({
          evidence_source_id: sourceId,
          ordinal: 1,
          external_revision: latest.content_hash,
          raw_sha256: latest.content_hash,
          normalized_text_sha256: latest.content_hash,
          media_type: "text/plain",
          byte_size: Buffer.byteLength(latest.text, "utf8"),
          parser_name: "journal-entry",
          parser_version: "1",
          processed_at: new Date().toISOString(),
          quarantine_status: "approved",
          prior_version_id: prior.data?.id ?? null
        })
        .select("id")
        .single();
      if (insertedVersion.error || !insertedVersion.data)
        throw insertedVersion.error ?? new Error("JOURNAL_EVIDENCE_VERSION_CREATE_FAILED");
      const evidenceVersionId = insertedVersion.data.id as string;
      const insertedChunks = await client
        .schema("app")
        .from("evidence_chunks")
        .insert(
          chunks.map((chunk) => ({
            evidence_version_id: evidenceVersionId,
            ordinal: chunk.ordinal,
            section_path: ["Journal", String(entry.title ?? "Journal entry")],
            char_start: chunk.charStart,
            char_end: chunk.charEnd,
            content: chunk.content,
            content_hash: chunk.contentHash,
            visibility: "private",
            trust_level: "owner_verified"
          }))
        )
        .select("id,ordinal,content_hash");
      if (insertedChunks.error || !insertedChunks.data)
        throw insertedChunks.error ?? new Error("JOURNAL_EVIDENCE_CHUNK_CREATE_FAILED");

      const rows = (insertedChunks.data as Array<{ id: string; ordinal: number; content_hash: string }>).map(
        (chunk, index) => ({
          chunk_id: chunk.id,
          provider: embedded.provider.provider,
          model: embedded.provider.model,
          model_version: embedded.provider.model_version,
          dimensions: PRODUCTION_EMBEDDING_DIMENSIONS,
          embedding_version: embeddingVersion,
          embedding: `[${embedded.vectors[index]?.join(",") ?? ""}]`,
          normalization: "l2",
          input_hash: chunk.content_hash,
          status: "completed"
        })
      );
      const embeddings = await client.schema("app").from("chunk_embeddings").insert(rows);
      if (embeddings.error) throw embeddings.error;

      const staleSources = await client
        .schema("app")
        .from("evidence_sources")
        .update({ availability: "unavailable" })
        .eq("owner_id", ownerId)
        .eq("source_type", "journal")
        .like("canonical_uri", `journal:${entryId}:%`)
        .neq("canonical_uri", canonicalUri);
      if (staleSources.error) throw staleSources.error;
      await requestCareerBrainRefresh(ownerId, "journal", `${entryId}:${latest.content_hash}`);
      return { status: "completed" as const, evidenceVersionId, chunks: chunks.length };
    });
  }
);
