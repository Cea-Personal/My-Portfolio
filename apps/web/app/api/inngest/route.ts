import { serve } from "inngest/next";
import { inngest } from "../../../inngest/client";
import { driveSync } from "../../../inngest/drive-sync";
import { jobSearch } from "../../../inngest/job-search";
import { analyticsAggregation } from "../../../inngest/analytics-aggregation";
import { documentIngestion } from "../../../inngest/document-ingestion";
import { durableDomainEvents } from "../../../inngest/durable-domain-events";
import { outboxDrain } from "../../../inngest/outbox-drain";
import { dataExport } from "../../../inngest/data-export";
import { automationScheduler } from "../../../inngest/automation-scheduler";
import { careerBrainRefresh } from "../../../inngest/career-brain-refresh";
import { embeddingBackfill } from "../../../inngest/embedding-backfill";

const handler = serve({
  client: inngest,
  functions: [
    driveSync,
    documentIngestion,
    embeddingBackfill,
    careerBrainRefresh,
    jobSearch,
    analyticsAggregation,
    ...durableDomainEvents,
    dataExport,
    outboxDrain,
    automationScheduler
  ]
});
export const GET = handler.GET;
export const POST = handler.POST;
export const PUT = handler.PUT;
