import { synthesizeCareerBrain } from "@/lib/server/career-brain-synthesis";
import { inngest } from "./client";
import { workflowClient } from "./workflow-state";

export const careerBrainRefresh = inngest.createFunction(
  {
    id: "career-brain-refresh",
    retries: 2,
    concurrency: [{ limit: 1, key: "event.data.ownerId" }],
    triggers: [{ event: "career/brain.refresh.requested.v1" }]
  },
  async ({ event, step }) => {
    const ownerId = typeof event.data.ownerId === "string" ? event.data.ownerId : null;
    if (!ownerId) throw new Error("CAREER_BRAIN_OWNER_REQUIRED");
    const client = workflowClient();
    if (!client) throw new Error("CAREER_BRAIN_WORKFLOW_CONFIGURATION_MISSING");
    return step.run("synthesize-current-private-profile", () =>
      synthesizeCareerBrain(client, ownerId, { serviceMode: true })
    );
  }
);
