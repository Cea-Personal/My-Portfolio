import { describe, expect, it } from "vitest";
import { nextCronOccurrence, parseCronExpression } from "./automation-cron";

describe("automation cron", () => {
  it("validates bounded five-field cron expressions", () => {
    expect(parseCronExpression("30 9 * * 1-5")).not.toBeNull();
    expect(parseCronExpression("*/15 * * * *")).not.toBeNull();
    expect(parseCronExpression("90 9 * * *")).toBeNull();
    expect(parseCronExpression("0 9 * *")).toBeNull();
  });

  it("calculates the next occurrence in the selected timezone", () => {
    expect(
      nextCronOccurrence(
        "30 9 * * *",
        "Africa/Kigali",
        new Date("2026-09-04T06:00:00Z")
      )?.toISOString()
    ).toBe("2026-09-04T07:30:00.000Z");
  });
});
