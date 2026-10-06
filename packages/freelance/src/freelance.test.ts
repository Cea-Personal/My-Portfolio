import { describe, expect, it } from "vitest";
import {
  calculateFreelancePricing,
  calculateFreelanceScore,
  normalizeManualOpportunity,
  transitionFreelanceApprovalState,
  transitionFreelanceCrmStatus,
  UpworkProvider
} from "./index";

describe("UpworkProvider", () => {
  it("supports manual imports without an API connection", () => {
    const result = new UpworkProvider().importManual({
      provider: "upwork",
      title: "Build an analytics pipeline",
      description: "Need a TypeScript and PostgreSQL delivery.",
      url: "https://www.upwork.com/jobs/~012345",
      budgetType: "fixed",
      budgetMin: 1000,
      budgetMax: 2000,
      currency: "usd",
      skills: ["TypeScript", "TypeScript"]
    });
    expect(result.importMode).toBe("manual");
    expect(result.skills).toEqual(["TypeScript"]);
    expect(result.fingerprint).toHaveLength(64);
  });

  it("keeps future API methods disabled until a connection is configured", async () => {
    await expect(new UpworkProvider().fetchOpportunities({})).rejects.toThrow(
      "UPWORK_CONNECTION_REQUIRED"
    );
  });
});

describe("freelance deterministic logic", () => {
  it("normalizes unknown budget without inventing a value", () => {
    const result = normalizeManualOpportunity({
      provider: "upwork",
      title: "Discovery project",
      description: "The client needs a discovery workshop."
    });
    expect(result.budgetType).toBe("unknown");
    expect(result.warnings).toContain("BUDGET_UNKNOWN");
  });

  it("calculates the weighted score and recommendation", () => {
    const result = calculateFreelanceScore({
      technicalFit: 100,
      evidenceStrength: 100,
      budgetEconomics: 80,
      winProbability: 70,
      clientQuality: 80,
      strategicValue: 70,
      scopeClarity: 90,
      deliveryRisk: 80
    });
    expect(result.totalScore).toBe(86);
    expect(result.recommendation).toBe("APPLY_NOW");
  });

  it("uses the fixed-price effort and risk formula", () => {
    const result = calculateFreelancePricing({
      pricingMode: "fixed",
      currency: "usd",
      estimatedHours: 40,
      targetEffectiveRate: 100,
      riskBufferPercent: 20
    });
    expect(result.minimumAmount).toBe(3600);
    expect(result.recommendedAmount).toBe(4800);
    expect(result.premiumAmount).toBe(6000);
  });

  it("requires evidence and explicit owner approval", () => {
    expect(() =>
      transitionFreelanceApprovalState("READY_FOR_REVIEW", "APPROVED", {
        hasUnsupportedMaterialClaims: true,
        explicitOwnerApproval: true
      })
    ).toThrow("UNSUPPORTED_PROPOSAL_CLAIMS");
    expect(() =>
      transitionFreelanceApprovalState("READY_FOR_REVIEW", "APPROVED", {
        hasUnsupportedMaterialClaims: false
      })
    ).toThrow("OWNER_APPROVAL_REQUIRED");
    expect(transitionFreelanceApprovalState("READY_FOR_REVIEW", "APPROVED", {
      hasUnsupportedMaterialClaims: false,
      explicitOwnerApproval: true
    })).toBe("APPROVED");
  });

  it("rejects invalid CRM transitions", () => {
    expect(() => transitionFreelanceCrmStatus("DISCOVERED", "SUBMITTED")).toThrow(
      "INVALID_FREELANCE_CRM_TRANSITION"
    );
  });
});
