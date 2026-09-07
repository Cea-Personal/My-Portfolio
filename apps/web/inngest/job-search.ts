import { inngest } from "./client";
import { createServiceSupabaseClient } from "@career-os/database";
import { executePersistedSearch } from "@career-os/jobs";

export const jobSearch = inngest.createFunction(
  { id: "job-search", retries: 3, triggers: [{ event: "career/job-search.requested.v1" }] },
  async ({ event, step }) => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      return step.run("fan-out-sources", async () => ({
        runId: String(event.data.runId),
        status: "deferred" as const,
        reason: "SUPABASE_SERVICE_ROLE_NOT_CONFIGURED"
      }));
    }
    return step.run("fan-out-sources", async () => {
      const client = createServiceSupabaseClient(url, serviceRoleKey);
      return executePersistedSearch({
        client,
        ownerId: String(event.data.ownerId),
        runId: String(event.data.runId),
        profileId: String(event.data.profileId),
        operationKey: String(event.data.operationKey),
        dailyNewJobLimit: 10,
        sourceIds: Array.isArray(event.data.sourceIds)
          ? event.data.sourceIds.filter((source): source is string => typeof source === "string")
          : []
      });
    });
  }
);
