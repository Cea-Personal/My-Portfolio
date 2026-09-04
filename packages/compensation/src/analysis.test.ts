import { describe, expect, it } from "vitest";
import { analyzeCompensation } from "./analysis";
describe("compensation analysis", () => {
  it("normalizes periods while retaining assumptions", () => {
    const result = analyzeCompensation(
      [
        {
          title: "Data Engineer",
          sourceUrl: "https://example.com/job",
          value: 10_000,
          currency: "USD",
          period: "monthly",
          observedAt: "2026-08-01",
          evidenceTier: "same_role_country"
        }
      ],
      "market_competitive"
    );
    expect(result.target).toBe(120_000);
    expect(result.normalized[0]?.conversion).toContain("12");
    expect(result.confidence).toBe("low");
  });
  it("refuses silent currency conversion", () => {
    expect(() =>
      analyzeCompensation(
        [
          {
            title: "A",
            sourceUrl: "https://example.com/a",
            value: 100,
            currency: "USD",
            period: "annual",
            observedAt: "2026-08-01",
            evidenceTier: "comparable_market"
          },
          {
            title: "B",
            sourceUrl: "https://example.com/b",
            value: 100,
            currency: "EUR",
            period: "annual",
            observedAt: "2026-08-01",
            evidenceTier: "comparable_market"
          }
        ],
        "conservative"
      )
    ).toThrow("EXPLICIT_CURRENCY_CONVERSION_REQUIRED");
  });
});
