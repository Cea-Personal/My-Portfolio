import { describe, expect, it } from "vitest";
import { workflowEventSchema } from "./events";

describe("workflow event names", () => {
  it("accepts namespaced events with multiple dotted action segments", () => {
    const parsed = workflowEventSchema.parse({
      name: "career/export.requested.v1",
      id: "export-1",
      ts: Date.now(),
      data: {
        schemaVersion: 1,
        ownerId: "00000000-0000-4000-8000-000000000001",
        correlationId: "correlation-1",
        resourceType: "export_request",
        resourceId: "00000000-0000-4000-8000-000000000002",
        operationKey: "export:export-1",
        requestedBy: "owner",
        metadata: {}
      }
    });

    expect(parsed.name).toBe("career/export.requested.v1");
  });
});
