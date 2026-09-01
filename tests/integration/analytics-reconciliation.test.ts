import { expect, it } from "vitest";
import { aggregateDaily } from "@career-os/analytics";

it("reconciles daily totals from source events", () => {
  const aggregate = aggregateDaily(
    [{ id: "1", name: "page_view", occurredAt: "2026-08-31T00:00:00Z" }],
    "2026-08-31"
  );
  expect(aggregate.eventCount).toBe(Object.values(aggregate.counts).reduce((a, b) => a + b, 0));
});
