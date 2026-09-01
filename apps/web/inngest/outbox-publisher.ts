import { stableEventId } from "@career-os/database";
import type { WorkflowEvent } from "@career-os/contracts";
import { inngest } from "./client";

export async function publishOutboxEvent(
  event: Pick<WorkflowEvent, "name" | "data">
): Promise<{ id: string }> {
  const id = stableEventId(event.name, event.data.operationKey);
  await inngest.send({ id, name: event.name, data: event.data });
  return { id };
}
