import type { SupabaseClient } from "@supabase/supabase-js";
import { inngest } from "./client";
import { beginRun, finishRun, recordStep, workflowClient } from "./workflow-state";

export const durableEventNames = [
  "career/document.removed.v1",
  "career/document.parse.requested.v1",
  "career/facts.extract.requested.v1",
  "career/embeddings.requested.v1",
  "career/fact.approved.v1",
  "career/portfolio.preview.requested.v1",
  "career/portfolio.published.v1",
  "career/portfolio.withdrawn.v1",
  "career/job-source.collect.requested.v1",
  "career/job.discovered.v1",
  "career/job.analyze.requested.v1",
  "career/application.artifact.requested.v1",
  "career/compensation.research.requested.v1",
  "career/interview-process.requested.v1",
  "career/interview-kit.requested.v1",
  "career/journal.insights.requested.v1",
  "career/post.assistance.requested.v1"
] as const;
const resourceTables: Record<
  string,
  { schema: "app" | "published"; table: string; ownerColumn: string }
> = {
  document: { schema: "app", table: "documents", ownerColumn: "owner_id" },
  job: { schema: "app", table: "jobs", ownerColumn: "owner_id" },
  application: { schema: "app", table: "applications", ownerColumn: "owner_id" },
  post: { schema: "app", table: "posts", ownerColumn: "owner_id" },
  journal_entry: { schema: "app", table: "journal_entries", ownerColumn: "owner_id" },
  interview_process: { schema: "app", table: "interview_processes", ownerColumn: "owner_id" },
  artifact: { schema: "app", table: "artifacts", ownerColumn: "owner_id" },
  fact: { schema: "app", table: "career_facts", ownerColumn: "owner_id" },
  publication: { schema: "published", table: "portfolio_publications", ownerColumn: "owner_id" }
};
async function verifyResource(
  client: SupabaseClient,
  ownerId: string,
  data: Record<string, unknown>
) {
  const resourceType = typeof data.resourceType === "string" ? data.resourceType : "";
  const resourceId = typeof data.resourceId === "string" ? data.resourceId : "";
  const target = resourceTables[resourceType];
  if (!target || !resourceId) throw new Error("RESOURCE_REFERENCE_NOT_ALLOWED");
  const result = await client
    .schema(target.schema)
    .from(target.table)
    .select("id")
    .eq("id", resourceId)
    .eq(target.ownerColumn, ownerId)
    .maybeSingle();
  if (result.error || !result.data)
    throw result.error ?? new Error("CROSS_OWNER_OR_MISSING_RESOURCE");
}
const durableEventGroups = [
  { id: "durable-domain-events-career", names: durableEventNames.slice(0, 9) },
  { id: "durable-domain-events-work", names: durableEventNames.slice(9) }
] as const;

// Inngest accepts at most ten triggers per function. Keep one shared bounded
// implementation, split across independently registered functions.
export const durableDomainEvents = durableEventGroups.map((group) =>
  inngest.createFunction(
    {
      id: group.id,
      retries: 3,
      concurrency: [{ limit: 1, key: "event.data.ownerId" }],
      triggers: group.names.map((event) => ({ event }))
    },
    async ({ event, step }) => {
      const client = workflowClient();
      if (!client) throw new Error("DURABLE_WORKFLOW_CONFIGURATION_MISSING");
      const envelope = event.data as Record<string, unknown>;
      const eventName: string = event.name;
      const run = await step.run("begin-run", async () =>
        beginRun(client, { id: event.id, name: eventName, data: envelope })
      );
      const operationKey =
        typeof envelope.operationKey === "string" ? envelope.operationKey : "invalid-operation";
      if (run.alreadyComplete) return { status: "unchanged" as const, runId: run.id };
      if (run.cancelled) {
        await finishRun(client, run.id, "cancelled");
        return { status: "cancelled" as const, runId: run.id };
      }
      if (envelope.schemaVersion !== 1) {
        await client
          .schema("app")
          .from("automation_dead_letters")
          .insert({
            owner_id: run.ownerId,
            run_id: run.id,
            event_id: event.id ?? crypto.randomUUID(),
            event_name: eventName,
            payload_metadata: { schemaVersion: envelope.schemaVersion ?? null },
            reason: "UNKNOWN_EVENT_SCHEMA_VERSION"
          });
        await recordStep(
          client,
          run.id,
          `${operationKey}:validate`,
          "validate-envelope",
          "failed",
          "UNKNOWN_EVENT_SCHEMA_VERSION"
        );
        await finishRun(client, run.id, "failed", "UNKNOWN_EVENT_SCHEMA_VERSION");
        return { status: "dead_lettered" as const, runId: run.id };
      }
      try {
        await step.run("verify-owner-resource", async () => {
          await verifyResource(client, run.ownerId, envelope);
          await recordStep(
            client,
            run.id,
            `${operationKey}:verify`,
            "verify-owner-resource",
            "completed"
          );
        });
        await step.run("apply-bounded-domain-action", async () => {
          if (eventName === "career/document.removed.v1") {
            const result = await client
              .schema("app")
              .from("documents")
              .update({ availability: "unavailable", removed_at: new Date().toISOString() })
              .eq("id", String(envelope.resourceId))
              .eq("owner_id", run.ownerId);
            if (result.error) throw result.error;
          }
          await recordStep(
            client,
            run.id,
            `${operationKey}:apply`,
            "apply-bounded-domain-action",
            "completed"
          );
        });
        await finishRun(client, run.id, "completed");
        return { status: "completed" as const, runId: run.id };
      } catch (error) {
        const code = error instanceof Error ? error.message.slice(0, 120) : "DURABLE_STEP_FAILED";
        await recordStep(
          client,
          run.id,
          `${operationKey}:apply`,
          "apply-bounded-domain-action",
          "failed",
          code
        );
        await finishRun(client, run.id, "failed", code);
        throw error;
      }
    }
  )
);
