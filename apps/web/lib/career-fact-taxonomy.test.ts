import { describe, expect, it } from "vitest";
import { normalizeCareerFactType, normalizeStructuredValue } from "./career-fact-taxonomy";

describe("career fact taxonomy", () => {
  it("folds experience details into an experience record", () => {
    expect(normalizeCareerFactType("responsibility")).toBe("experience");
    expect(normalizeCareerFactType("achievement")).toBe("experience");
    expect(normalizeCareerFactType("impact")).toBe("experience");
  });

  it("keeps experience identity and nested details", () => {
    expect(
      normalizeStructuredValue("experience", {
        factType: "impact",
        organization: " Example Ltd ",
        role: " Data Engineer ",
        impacts: "Reduced failures by 42%"
      })
    ).toMatchObject({
      organization: "Example Ltd",
      role: "Data Engineer",
      impacts: ["Reduced failures by 42%"],
      responsibilities: []
    });
  });
});
