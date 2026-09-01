import { randomUUID } from "node:crypto";

const SAFE_KEYS = new Set([
  "status",
  "visibility",
  "revision",
  "version",
  "sourceType",
  "reason",
  "count"
]);

export interface AuditEventInput {
  ownerId: string;
  actorType: "owner" | "workflow" | "provider" | "system";
  actorId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  correlationId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
}

export function allowlistAuditMetadata(
  value: Record<string, unknown> | undefined
): Record<string, string | number | boolean | null> {
  if (!value) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => SAFE_KEYS.has(key))
      .map(([key, item]) => [
        key,
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean" ||
        item === null
          ? item
          : String(item)
      ])
  );
}

export function createAuditEvent(input: AuditEventInput) {
  return {
    id: randomUUID(),
    ...input,
    before: allowlistAuditMetadata(input.before),
    after: allowlistAuditMetadata(input.after),
    occurredAt: new Date().toISOString()
  };
}
