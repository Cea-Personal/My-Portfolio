import { createHash } from "node:crypto";
import { inngest } from "./client";
import { beginRun, finishRun, recordStep, workflowClient } from "./workflow-state";
const exportTables = [
  "career_facts",
  "evidence_sources",
  "skills",
  "experiences",
  "projects",
  "jobs",
  "applications",
  "interview_processes",
  "journal_entries",
  "star_stories",
  "posts"
] as const;
export const dataExport = inngest.createFunction(
  {
    id: "private-data-export",
    retries: 2,
    concurrency: [{ limit: 1, key: "event.data.ownerId" }],
    triggers: [{ event: "career/export.requested.v1" }]
  },
  async ({ event, step }) => {
    const client = workflowClient();
    if (!client) throw new Error("EXPORT_CONFIGURATION_MISSING");
    const envelope = event.data as Record<string, unknown>;
    const exportId = typeof envelope.resourceId === "string" ? envelope.resourceId : "";
    let run: Awaited<ReturnType<typeof beginRun>>;
    try {
      run = await step.run("begin-run", async () =>
        beginRun(client, { id: event.id, name: "career/export.requested.v1", data: envelope })
      );
    } catch (error) {
      // A failure before beginRun (for example a missing owner authorization)
      // previously left the request permanently queued with no UI diagnostic.
      if (exportId) {
        await client
          .schema("app")
          .from("export_requests")
          .update({ status: "failed" })
          .eq("id", exportId)
          .eq("owner_id", typeof envelope.ownerId === "string" ? envelope.ownerId : "");
      }
      throw error;
    }
    if (run.cancelled) {
      await finishRun(client, run.id, "cancelled");
      return { status: "cancelled" as const };
    }
    if (run.alreadyComplete) return { status: "unchanged" as const };
    const operationKey =
      typeof envelope.operationKey === "string" ? envelope.operationKey : `export:${exportId}`;
    return step.run("build-private-export", async () => {
      const request = await client
        .schema("app")
        .from("export_requests")
        .select("id,status,format")
        .eq("id", exportId)
        .eq("owner_id", run.ownerId)
        .maybeSingle();
      if (request.error || !request.data) {
        await client
          .schema("app")
          .from("export_requests")
          .update({ status: "failed" })
          .eq("id", exportId)
          .eq("owner_id", run.ownerId);
        throw request.error ?? new Error("EXPORT_REQUEST_NOT_FOUND");
      }
      await client
        .schema("app")
        .from("export_requests")
        .update({ status: "running" })
        .eq("id", exportId)
        .eq("owner_id", run.ownerId);
      try {
        const resources: Record<string, unknown[]> = {};
        for (const table of exportTables) {
          const result = await client
            .schema("app")
            .from(table)
            .select("*")
            .eq("owner_id", run.ownerId)
            .limit(50_000);
          if (result.error) throw result.error;
          resources[table] = result.data ?? [];
        }
        const createdAt = new Date().toISOString();
        const serialized = JSON.stringify({
          schemaVersion: "career-export.v1",
          createdAt,
          resources
        });
        const hash = createHash("sha256").update(serialized).digest("hex");
        const objectKey = `${run.ownerId}/exports/${exportId}/${hash}.json`;
        const upload = await client.storage
          .from("private-artifact")
          .upload(objectKey, serialized, { contentType: "text/plain", upsert: true });
        if (upload.error) throw upload.error;
        const update = await client
          .schema("app")
          .from("export_requests")
          .update({
            status: "completed",
            object_key: objectKey,
            manifest_hash: hash,
            expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
            completed_at: new Date().toISOString()
          })
          .eq("id", exportId)
          .eq("owner_id", run.ownerId);
        if (update.error) throw update.error;
        await recordStep(
          client,
          run.id,
          `${operationKey}:build`,
          "build-private-export",
          "completed"
        );
        await finishRun(client, run.id, "completed");
        return { status: "completed" as const, exportId, manifestHash: hash };
      } catch (error) {
        const code = error instanceof Error ? error.message.slice(0, 120) : "EXPORT_BUILD_FAILED";
        await client
          .schema("app")
          .from("export_requests")
          .update({ status: "failed" })
          .eq("id", exportId)
          .eq("owner_id", run.ownerId);
        await recordStep(
          client,
          run.id,
          `${operationKey}:build`,
          "build-private-export",
          "failed",
          code
        );
        await finishRun(client, run.id, "failed", code);
        throw error;
      }
    });
  }
);
