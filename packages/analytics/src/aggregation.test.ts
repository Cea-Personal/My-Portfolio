import { expect, it } from "vitest";
import { aggregateDaily } from "./aggregation";
it("rebuilds daily aggregates deterministically", () => {
  expect(
    aggregateDaily(
      [{ id: "1", name: "page_view", occurredAt: "2026-08-31T00:00:00Z" }],
      "2026-08-31"
    ).eventCount
  ).toBe(1);
});
