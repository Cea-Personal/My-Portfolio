import { createHash, randomUUID } from "node:crypto";
import type { WorkflowEvent } from "@career-os/contracts";

export interface OutboxEvent {
  id: string;
  eventName: string;
  idempotencyKey: string;
  payload: WorkflowEvent["data"];
  status: "pending" | "published" | "failed";
  availableAt: string;
  attemptCount: number;
}

export function stableEventId(eventName: string, idempotencyKey: string): string {
  return createHash("sha256").update(`${eventName}:${idempotencyKey}`).digest("hex");
}

export function createOutboxEvent(
  eventName: string,
  idempotencyKey: string,
  payload: WorkflowEvent["data"]
): OutboxEvent {
  return {
    id: stableEventId(eventName, idempotencyKey) || randomUUID(),
    eventName,
    idempotencyKey,
    payload,
    status: "pending",
    availableAt: new Date().toISOString(),
    attemptCount: 0
  };
}
