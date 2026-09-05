import { inngest } from "./client";

export async function requestCareerBrainRefresh(
  ownerId: string,
  sourceType: string,
  sourceId: string
) {
  await inngest.send({
    name: "career/brain.refresh.requested.v1",
    id: `career-brain:${sourceType}:${sourceId}`,
    data: {
      schemaVersion: 1,
      ownerId,
      resourceType: sourceType,
      resourceId: sourceId,
      operationKey: `career-brain:${sourceType}:${sourceId}`,
      requestedBy: "system",
      metadata: {}
    }
  });
}
