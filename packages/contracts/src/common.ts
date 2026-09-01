import { z } from "zod";

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const timestamp = z.string().datetime({ offset: true });

export const idSchema = uuid;
export const correlationIdSchema = z.string().min(8).max(128);
export const visibilitySchema = z.enum(["public", "private", "restricted"]);
export const trustLevelSchema = z.enum([
  "verified_document",
  "owner_verified",
  "corroborated",
  "ai_extracted_reviewed",
  "ai_extracted",
  "ai_inferred"
]);
export const reviewStatusSchema = z.enum([
  "candidate",
  "in_review",
  "approved",
  "edited_approved",
  "rejected",
  "deferred"
]);
export const runStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "partial",
  "failed",
  "cancelled"
]);

export const moneySchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,4})?$/, "Money must be a decimal string"),
  currency: z.string().regex(/^[A-Z]{3}$/, "Currency must be an ISO 4217 code")
});

export const dateRangeSchema = z
  .object({ startDate: isoDate.optional(), endDate: isoDate.optional() })
  .refine(({ startDate, endDate }) => !startDate || !endDate || startDate <= endDate, {
    message: "endDate cannot precede startDate",
    path: ["endDate"]
  });

export const auditActorSchema = z.enum(["owner", "workflow", "provider", "system"]);
export const requestedBySchema = z.enum(["owner", "schedule", "provider", "system"]);
export const boundedMetadataSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .superRefine((value, ctx) => {
    if (JSON.stringify(value).length > 16 * 1024) {
      ctx.addIssue({ code: "custom", message: "Metadata must be <= 16 KiB" });
    }
  });

export const eventBaseSchema = z.object({
  schemaVersion: z.literal(1),
  ownerId: uuid,
  correlationId: correlationIdSchema,
  causationId: z.string().max(256).optional(),
  resourceType: z.string().min(1).max(64),
  resourceId: uuid,
  operationKey: z.string().min(1).max(256),
  requestedBy: requestedBySchema,
  metadata: boundedMetadataSchema.default({})
});

export type Id = z.infer<typeof idSchema>;
export type Visibility = z.infer<typeof visibilitySchema>;
export type TrustLevel = z.infer<typeof trustLevelSchema>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type RunStatus = z.infer<typeof runStatusSchema>;
export type Money = z.infer<typeof moneySchema>;
export type EventBase = z.infer<typeof eventBaseSchema>;
export type Timestamp = z.infer<typeof timestamp>;

export function assertUtcTimestamp(value: string): Timestamp {
  return timestamp.parse(value);
}

export function nowUtc(): Timestamp {
  return new Date().toISOString();
}
