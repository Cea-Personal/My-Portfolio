import { describe, expect, it } from "vitest";
import { countBy, parseAnalyticsFilters, suppressSmallCounts } from "./analytics-filters";
describe("analytics filters", () => {
  it("rejects parameters outside the endpoint allowlist", () => {
    expect(() =>
      parseAnalyticsFilters(new Request("https://example.test?query=secret"), ["role"])
    ).toThrow("FILTER_NOT_ALLOWED");
  });
  it("parses bounded numeric filters", () => {
    expect(
      parseAnalyticsFilters(new Request("https://example.test?minMatch=72"), ["minMatch"])
    ).toEqual({ minMatch: 72 });
  });
  it("suppresses low-volume groups", () => {
    expect(suppressSmallCounts(countBy(["view", "view"])).view).toEqual({
      count: null,
      lowVolume: true
    });
  });
});
