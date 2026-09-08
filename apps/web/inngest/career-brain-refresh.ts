import { synthesizeCareerBrain } from "@/lib/server/career-brain-synthesis";
import { inngest } from "./client";
import { workflowClient } from "./workflow-state";

export const careerBrainRefresh = inngest.createFunction(
  {
    id: "career-brain-refresh",
    retries: 2,
    concurrency: [{ limit: 1, key: "event.data.ownerId" }],
    debounce: { key: "event.data.ownerId", period: "30s", timeout: "5m" },
    triggers: [{ event: "career/brain.refresh.requested.v1" }]
  },
  async ({ event, step }) => {
    const ownerId = typeof event.data.ownerId === "string" ? event.data.ownerId : null;
    if (!ownerId) throw new Error("CAREER_BRAIN_OWNER_REQUIRED");
    const client = workflowClient();
    if (!client) throw new Error("CAREER_BRAIN_WORKFLOW_CONFIGURATION_MISSING");
    const automationRunId =
      typeof event.data.automationRunId === "string" ? event.data.automationRunId : null;
    const refreshRetrievalCache = event.data.refreshRetrievalCache === true;
    try {
      const result = await step.run("synthesize-current-private-profile", () =>
        synthesizeCareerBrain(client, ownerId, {
          serviceMode: true,
          refreshRetrievalCache
        })
      );
      if (automationRunId) {
        await step.run("mark-career-brain-run-complete", async () => {
          const update = await client
            .schema("app")
            .from("automation_runs")
            .update({
              status: "completed",
              finished_at: new Date().toISOString(),
              error_code: null
            })
            .eq("id", automationRunId)
            .eq("owner_id", ownerId);
          if (update.error) throw update.error;
        });
      }
      return result;
    } catch (error) {
      if (automationRunId) {
        await client
          .schema("app")
          .from("automation_runs")
          .update({
            status: "failed",
            finished_at: new Date().toISOString(),
            error_code: error instanceof Error ? error.message.slice(0, 120) : "CAREER_BRAIN_FAILED"
          })
          .eq("id", automationRunId)
          .eq("owner_id", ownerId);
      }
      throw error;
    }
  }
);
