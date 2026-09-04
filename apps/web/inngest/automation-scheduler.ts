import { randomUUID } from "node:crypto";
import { createServiceSupabaseClient } from "@career-os/database/service";
import { nextCronOccurrence } from "@/lib/automation-cron";
import { inngest } from "./client";

function configuredClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createServiceSupabaseClient(url, key) : null;
}

export const automationScheduler = inngest.createFunction(
  {
    id: "automation-scheduler",
    retries: 2,
    triggers: [{ cron: "* * * * *" }],
    concurrency: [{ limit: 1 }]
  },
  async ({ step }) => {
    const client = configuredClient();
    if (!client) throw new Error("AUTOMATION_SCHEDULER_CONFIGURATION_MISSING");
    const now = new Date();
    const due = await step.run("load-due-schedules", async () => {
      const result = await client
        .schema("app")
        .from("automation_schedules")
        .select("id,owner_id,purpose,profile_id,cron_expression,timezone,next_run_at")
        .eq("enabled", true)
        .lte("next_run_at", now.toISOString())
        .order("next_run_at")
        .limit(25);
      if (result.error) throw result.error;
      return result.data ?? [];
    });

    const outcomes: Array<{ scheduleId: string; status: string }> = [];
    for (const schedule of due) {
      await step.run(`dispatch-${schedule.id}-${schedule.next_run_at}`, async () => {
        const dueAt = String(schedule.next_run_at);
        const nextRun = nextCronOccurrence(
          String(schedule.cron_expression),
          String(schedule.timezone),
          new Date(Math.max(now.getTime(), Date.parse(dueAt)))
        );
        if (!nextRun) throw new Error("AUTOMATION_NEXT_RUN_INVALID");
        const claimed = await client
          .schema("app")
          .from("automation_schedules")
          .update({ last_run_at: dueAt, next_run_at: nextRun.toISOString() })
          .eq("id", schedule.id)
          .eq("owner_id", schedule.owner_id)
          .eq("enabled", true)
          .eq("next_run_at", dueAt)
          .select("id")
          .maybeSingle();
        if (claimed.error) throw claimed.error;
        if (!claimed.data) return;

        const operationKey = `schedule:${schedule.id}:${dueAt}`;
        const correlationId = randomUUID();
        const automationRun = await client
          .schema("app")
          .from("automation_runs")
          .insert({
            owner_id: schedule.owner_id,
            workflow_name: schedule.purpose,
            status: "pending",
            correlation_id: correlationId,
            idempotency_key: operationKey
          })
          .select("id")
          .single();
        if (automationRun.error || !automationRun.data)
          throw automationRun.error ?? new Error("AUTOMATION_RUN_CREATE_FAILED");

        try {
          if (schedule.purpose !== "drive_sync")
            throw new Error("SCHEDULED_PURPOSE_NOT_IMPLEMENTED");
          const connection = await client
            .schema("app")
            .from("integration_connections")
            .select("id")
            .eq("owner_id", schedule.owner_id)
            .eq("provider", "drive")
            .eq("status", "active")
            .eq("connection_type", "service_account")
            .maybeSingle();
          if (connection.error) throw connection.error;
          if (!connection.data) throw new Error("ACTIVE_DRIVE_CONNECTION_REQUIRED");
          const ingestion = await client
            .schema("app")
            .from("ingestion_runs")
            .insert({
              owner_id: schedule.owner_id,
              trigger: "schedule",
              connection_id: connection.data.id,
              correlation_id: correlationId,
              idempotency_key: operationKey,
              workflow_run_id: automationRun.data.id,
              status: "pending"
            })
            .select("id")
            .single();
          if (ingestion.error || !ingestion.data)
            throw ingestion.error ?? new Error("INGESTION_RUN_CREATE_FAILED");
          await inngest.send({
            name: "career/drive.sync.requested.v1",
            id: operationKey,
            data: {
              schemaVersion: 1,
              ownerId: schedule.owner_id,
              correlationId,
              resourceType: "ingestion_run",
              resourceId: ingestion.data.id,
              operationKey,
              requestedBy: "schedule",
              metadata: { scheduleId: schedule.id, automationRunId: automationRun.data.id },
              runId: ingestion.data.id
            }
          });
          await client
            .schema("app")
            .from("automation_runs")
            .update({ status: "running", started_at: new Date().toISOString() })
            .eq("id", automationRun.data.id);
          outcomes.push({ scheduleId: schedule.id, status: "dispatched" });
        } catch (error) {
          const code = error instanceof Error ? error.message.slice(0, 120) : "SCHEDULE_FAILED";
          await client
            .schema("app")
            .from("automation_runs")
            .update({
              status: "failed",
              error_code: code,
              finished_at: new Date().toISOString()
            })
            .eq("id", automationRun.data.id);
          outcomes.push({ scheduleId: schedule.id, status: `failed:${code}` });
        }
      });
    }
    return { checkedAt: now.toISOString(), outcomes };
  }
);
