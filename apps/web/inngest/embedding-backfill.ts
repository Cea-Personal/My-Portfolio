import { createServiceSupabaseClient } from "@career-os/database/service";
import {
  embedWithFallback,
  PRODUCTION_EMBEDDING_DIMENSIONS,
  resolveEmbeddingProviders
} from "@/lib/server/embedding-provider";
import { inngest } from "./client";
import { requestCareerBrainRefresh } from "./career-brain-events";

interface ChunkRow {
  id: string;
  content: string;
  content_hash: string;
}

function configuredClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createServiceSupabaseClient(url, key) : null;
}

export const embeddingBackfill = inngest.createFunction(
  {
    id: "career-embedding-backfill",
    retries: 2,
    concurrency: [{ limit: 1, key: "event.data.ownerId" }],
    triggers: [{ event: "career/embeddings.backfill.requested.v1" }]
  },
  async ({ event, step }) => {
    const ownerId = typeof event.data.ownerId === "string" ? event.data.ownerId : null;
    const metadata =
      event.data.metadata && typeof event.data.metadata === "object"
        ? (event.data.metadata as Record<string, unknown>)
        : {};
    const runId = typeof metadata.ingestionRunId === "string" ? metadata.ingestionRunId : null;
    const client = configuredClient();
    if (!ownerId || !runId) throw new Error("EMBEDDING_BACKFILL_EVENT_INVALID");
    if (!client) throw new Error("EMBEDDING_BACKFILL_CONFIGURATION_MISSING");

    try {
      await step.run("mark-embedding-backfill-running", async () => {
        const { error } = await client
          .schema("app")
          .from("ingestion_runs")
          .update({
            status: "running",
            started_at: new Date().toISOString(),
            finished_at: null,
            error_summary: null
          })
          .eq("id", runId)
          .eq("owner_id", ownerId);
        if (error) throw error;
      });

      const providers = await resolveEmbeddingProviders(client, ownerId);
      let page = 0;
      let indexed = 0;
      const pageSize = 100;
      while (true) {
        const result = await step.run(`embed-existing-chunks-${String(page)}`, async () => {
          const start = page * pageSize;
          const { data, error } = await client
            .schema("app")
            .from("evidence_chunks")
            .select("id,content,content_hash,evidence_versions!inner(evidence_sources!inner(owner_id))")
            .eq("evidence_versions.evidence_sources.owner_id", ownerId)
            .is("deleted_at", null)
            .order("id")
            .range(start, start + pageSize - 1);
          if (error) throw error;
          const chunks = (data ?? []) as unknown as ChunkRow[];
          if (!chunks.length) return { pageSize: 0, indexed: 0 };

          const chunkIds = chunks.map((chunk) => chunk.id);
          const configuredVersions = providers.map(
            (provider) => `${provider.provider}:${provider.model}:${provider.model_version}`
          );
          const { data: existing, error: existingError } = await client
            .schema("app")
            .from("chunk_embeddings")
            .select("chunk_id")
            .in("chunk_id", chunkIds)
            .in("embedding_version", configuredVersions)
            .eq("status", "completed");
          if (existingError) throw existingError;
          const completed = new Set((existing ?? []).map((item) => String(item.chunk_id)));
          const missing = chunks.filter((chunk) => !completed.has(chunk.id));
          if (!missing.length) return { pageSize: chunks.length, indexed: 0 };

          const embedded = await embedWithFallback(
            providers,
            missing.map((chunk) => chunk.content)
          );
          const embeddingVersion = `${embedded.provider.provider}:${embedded.provider.model}:${embedded.provider.model_version}`;
          const { error: insertError } = await client
            .schema("app")
            .from("chunk_embeddings")
            .upsert(
              missing.map((chunk, index) => ({
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
              })),
              { onConflict: "chunk_id,embedding_version", ignoreDuplicates: true }
            );
          if (insertError) throw insertError;
          return { pageSize: chunks.length, indexed: missing.length };
        });
        indexed += result.indexed;
        if (result.pageSize < pageSize) break;
        page += 1;
      }

      await step.run("complete-embedding-backfill", async () => {
        const { error } = await client
          .schema("app")
          .from("ingestion_runs")
          .update({
            status: "completed",
            document_count: indexed,
            finished_at: new Date().toISOString(),
            error_summary: null
          })
          .eq("id", runId)
          .eq("owner_id", ownerId);
        if (error) throw error;
        await requestCareerBrainRefresh(ownerId, "embedding-backfill", runId);
      });
      return { status: "completed" as const, indexed };
    } catch (error) {
      const diagnostic = error instanceof Error ? error.message.slice(0, 500) : "UNKNOWN_FAILURE";
      await client
        .schema("app")
        .from("ingestion_runs")
        .update({
          status: "failed",
          error_summary: diagnostic,
          finished_at: new Date().toISOString()
        })
        .eq("id", runId)
        .eq("owner_id", ownerId);
      throw error;
    }
  }
);
