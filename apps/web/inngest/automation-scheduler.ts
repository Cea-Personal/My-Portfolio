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
            idempotency_key: operationKey,
            ...(schedule.purpose === "career_brain"
              ? {
                  context_metadata: {
                    resourceType: "career_brain",
                    resourceId: schedule.owner_id,
                    scheduleId: schedule.id,
                    refreshRetrievalCache: true
                  }
                }
              : {})
          })
          .select("id")
          .single();
        if (automationRun.error || !automationRun.data)
          throw automationRun.error ?? new Error("AUTOMATION_RUN_CREATE_FAILED");

        try {
          if (schedule.purpose === "career_brain") {
            const brainOperationKey = `schedule:${schedule.id}:${dueAt}`;
            await inngest.send({
              name: "career/brain.refresh.requested.v1",
              id: brainOperationKey,
              data: {
                schemaVersion: 1,
                ownerId: schedule.owner_id,
                correlationId,
                resourceType: "career_brain",
                resourceId: schedule.owner_id,
                operationKey: brainOperationKey,
                requestedBy: "schedule",
                metadata: {
                  scheduleId: schedule.id,
                  automationRunId: automationRun.data.id,
                  refreshRetrievalCache: true
                },
                automationRunId: automationRun.data.id,
                refreshRetrievalCache: true
              }
            });
            await client
              .schema("app")
              .from("automation_runs")
              .update({ status: "running", started_at: new Date().toISOString() })
              .eq("id", automationRun.data.id);
            outcomes.push({ scheduleId: schedule.id, status: "career_brain_dispatched" });
            return;
          }
          if (schedule.purpose === "job_search") {
            const weekday = new Intl.DateTimeFormat("en-US", {
              timeZone: String(schedule.timezone),
              weekday: "short"
            }).format(now);
            if (weekday === "Sat" || weekday === "Sun") {
              await client
                .schema("app")
                .from("automation_runs")
                .update({
                  status: "completed",
                  finished_at: new Date().toISOString(),
                  error_code: "WEEKEND_JOB_SEARCH_SKIPPED"
                })
                .eq("id", automationRun.data.id);
              outcomes.push({ scheduleId: schedule.id, status: "weekend_skipped" });
              return;
            }
            if (!schedule.profile_id) throw new Error("JOB_SEARCH_PROFILE_REQUIRED");
            const sources = await client
              .schema("app")
              .from("job_sources")
              .select("id")
              .eq("owner_id", schedule.owner_id)
              .eq("enabled", true);
            if (sources.error) throw sources.error;
            const sourceIds = (sources.data ?? [])
              .map((row) => row.id)
              .filter((id): id is string => typeof id === "string");
            if (!sourceIds.length) throw new Error("NO_ENABLED_JOB_SOURCES");
            const dateParts = new Intl.DateTimeFormat("en-US", {
              timeZone: String(schedule.timezone),
              year: "numeric",
              month: "2-digit",
              day: "2-digit"
            })
              .formatToParts(now)
              .reduce<Record<string, string>>((result, part) => {
                if (part.type !== "literal") result[part.type] = part.value;
                return result;
              }, {});
            const logicalDate = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
            const searchRun = await client
              .schema("app")
              .from("job_search_runs")
              .insert({
                owner_id: schedule.owner_id,
                profile_id: schedule.profile_id,
                trigger_type: "schedule",
                logical_date: logicalDate,
                correlation_id: correlationId,
                status: "pending"
              })
              .select("id")
              .single();
            if (searchRun.error || !searchRun.data)
              throw searchRun.error ?? new Error("SEARCH_RUN_CREATE_FAILED");
            const runSources = await client
              .schema("app")
              .from("job_search_run_sources")
              .insert(sourceIds.map((sourceId) => ({ run_id: searchRun.data.id, source_id: sourceId })));
            if (runSources.error) throw runSources.error;
            const searchOperationKey = `schedule:${schedule.id}:${dueAt}`;
            await inngest.send({
              name: "career/job-search.requested.v1",
              id: searchOperationKey,
              data: {
                schemaVersion: 1,
                ownerId: schedule.owner_id,
                correlationId,
                resourceType: "job_search_run",
                resourceId: searchRun.data.id,
                operationKey: searchOperationKey,
                requestedBy: "schedule",
                metadata: { scheduleId: schedule.id, automationRunId: automationRun.data.id },
                runId: searchRun.data.id,
                profileId: schedule.profile_id,
                sourceIds
              }
            });
            await client
              .schema("app")
              .from("automation_runs")
              .update({ status: "running", started_at: new Date().toISOString() })
              .eq("id", automationRun.data.id);
            outcomes.push({ scheduleId: schedule.id, status: "job_search_dispatched" });
            return;
          }
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
