import { z } from "zod";
import { eventBaseSchema } from "./common";

export const workflowEventSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+\.v\d+$/),
  id: z.string().min(1).max(256),
  ts: z.number().int().positive(),
  data: eventBaseSchema
});

export type WorkflowEvent = z.infer<typeof workflowEventSchema>;

export const eventNames = [
  "career/drive.sync.requested.v1",
  "career/document.changed.v1",
  "career/brain.refresh.requested.v1",
  "career/document.removed.v1",
  "career/document.parse.requested.v1",
  "career/facts.extract.requested.v1",
  "career/embeddings.requested.v1",
  "career/fact.approved.v1",
  "career/portfolio.preview.requested.v1",
  "career/portfolio.published.v1",
  "career/portfolio.withdrawn.v1",
  "career/job-search.requested.v1",
  "career/job-source.collect.requested.v1",
  "career/job.discovered.v1",
  "career/job.analyze.requested.v1",
  "career/application.artifact.requested.v1",
  "career/compensation.research.requested.v1",
  "career/interview-process.requested.v1",
  "career/interview-kit.requested.v1",
  "career/journal.insights.requested.v1",
  "career/post.assistance.requested.v1",
  "career/analytics.aggregate.requested.v1",
  "career/export.requested.v1"
] as const;

export const eventNameSchema = z.enum(eventNames);

export function createEvent(
  name: (typeof eventNames)[number],
  data: z.infer<typeof eventBaseSchema>,
  id: string
): WorkflowEvent {
  return workflowEventSchema.parse({ name, id, ts: Date.now(), data });
}
