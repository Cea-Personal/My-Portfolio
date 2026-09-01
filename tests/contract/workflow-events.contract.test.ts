import { expect, it } from "vitest";
import { workflowEventSchema } from "@career-os/contracts";
it("rejects unversioned workflow event names", () => {
  expect(() => workflowEventSchema.parse({ name: "event", id: "x", ts: 1, data: {} })).toThrow();
});
