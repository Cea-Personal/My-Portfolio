import { eventNameSchema, workflowEventSchema } from "@career-os/contracts";
import { inngest } from "./client";
import { publishOutboxEvent } from "./outbox-publisher";
import { workflowClient } from "./workflow-state";

export const outboxDrain = inngest.createFunction(
  {
    id: "outbox-drain",
    retries: 2,
    triggers: [{ cron: "*/1 * * * *" }, { event: "career/outbox.drain.requested.v1" }],
    concurrency: [{ limit: 1 }]
  },
  async ({ step }) => {
    const client = workflowClient();
    if (!client) throw new Error("OUTBOX_CONFIGURATION_MISSING");
    const events = await step.run("claim-available-events", async () => {
      const result = await client
        .schema("app")
        .from("outbox_events")
        .select("id,event_name,payload,idempotency_key,attempt_count")
        .eq("status", "pending")
        .lte("available_at", new Date().toISOString())
        .order("created_at")
        .limit(50);
      if (result.error) throw result.error;
      return result.data ?? [];
    });
    const outcomes: Array<{ id: string; status: string }> = [];
    for (const row of events) {
      await step.run(`publish-${row.id}`, async () => {
        try {
          const name = eventNameSchema.parse(row.event_name);
          const envelope = workflowEventSchema.parse({
            name,
            id: row.id,
            ts: Date.now(),
            data: row.payload
          });
          await publishOutboxEvent(envelope);
          const update = await client
            .schema("app")
            .from("outbox_events")
            .update({
              status: "published",
              published_at: new Date().toISOString(),
              attempt_count: Number(row.attempt_count) + 1,
              last_error_code: null
            })
            .eq("id", row.id)
            .eq("status", "pending");
          if (update.error) throw update.error;
          outcomes.push({ id: row.id, status: "published" });
        } catch (error) {
          const attempt = Number(row.attempt_count) + 1;
          const code =
            error instanceof Error ? error.message.slice(0, 120) : "OUTBOX_PUBLISH_FAILED";
          const terminal = attempt >= 5;
          const update = await client
            .schema("app")
            .from("outbox_events")
            .update({
              status: terminal ? "failed" : "pending",
              attempt_count: attempt,
              last_error_code: code,
              available_at: new Date(
                Date.now() + Math.min(60_000, 1000 * 2 ** attempt)
              ).toISOString()
            })
            .eq("id", row.id);
          if (update.error) throw update.error;
          const payload = row.payload as Record<string, unknown>;
          if (terminal && typeof payload.ownerId === "string") {
            const deadLetter = await client
              .schema("app")
              .from("automation_dead_letters")
              .insert({
                owner_id: payload.ownerId,
                event_id: row.id,
                event_name: row.event_name,
                payload_metadata: {
                  schemaVersion: payload.schemaVersion ?? null,
                  resourceType: payload.resourceType ?? null,
                  resourceId: payload.resourceId ?? null
                },
                reason: code
              });
            if (deadLetter.error) throw deadLetter.error;
          }
          outcomes.push({ id: row.id, status: terminal ? "dead_lettered" : "retry_scheduled" });
        }
      });
    }
    return { drained: outcomes.length, outcomes };
  }
);
