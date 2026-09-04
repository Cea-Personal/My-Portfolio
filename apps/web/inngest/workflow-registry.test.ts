import { eventNames } from "@career-os/contracts";
import { describe, expect, it } from "vitest";
import { durableEventNames } from "./durable-domain-events";
const specialized = [
  "career/drive.sync.requested.v1",
  "career/document.changed.v1",
  "career/job-search.requested.v1",
  "career/analytics.aggregate.requested.v1",
  "career/export.requested.v1"
];
describe("durable workflow registry", () => {
  it("registers every contracted domain event exactly once", () => {
    const registered = [...specialized, ...durableEventNames];
    expect(new Set(registered).size).toBe(registered.length);
    expect([...registered].sort()).toEqual([...eventNames].sort());
  });
});
