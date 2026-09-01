import { inngest } from "./client";

export const analyticsAggregation = inngest.createFunction(
  {
    id: "analytics-aggregation",
    retries: 3,
    triggers: [{ event: "career/analytics.aggregate.requested.v1" }]
  },
  async ({ event, step }) =>
    step.run("rebuild-daily", async () => ({
      ownerId: event.data.ownerId as string,
      day: event.data.day as string,
      status: "completed" as const,
      calculationVersion: "analytics.v1"
    }))
);
