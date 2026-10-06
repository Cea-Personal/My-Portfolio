export const FREELANCE_SCORE_WEIGHTS = {
  technicalFit: 25,
  evidenceStrength: 15,
  budgetEconomics: 15,
  winProbability: 15,
  clientQuality: 10,
  strategicValue: 10,
  scopeClarity: 5,
  deliveryRisk: 5
} as const;
export type FreelanceScoreWeights = Record<keyof typeof FREELANCE_SCORE_WEIGHTS, number>;

export type FreelanceProvider = "upwork" | (string & {});
export type ImportMode = "manual" | "url_reference" | "api";
export type BudgetType = "hourly" | "fixed" | "milestone" | "unknown";
export type PricingMode = Exclude<BudgetType, "unknown">;
export type FreelanceRecommendation =
  | "APPLY_NOW"
  | "APPLY"
  | "CONSIDER"
  | "LOW_PRIORITY"
  | "SKIP";

export interface ManualOpportunityInput {
  provider: FreelanceProvider;
  title: string;
  description: string;
  url?: string;
  clientName?: string;
  clientUrl?: string;
  clientCountry?: string;
  clientTimezone?: string;
  budgetType?: BudgetType;
  budgetMin?: number;
  budgetMax?: number;
  hourlyMin?: number;
  hourlyMax?: number;
  currency?: string;
  duration?: string;
  timezoneRequirements?: string;
  skills?: readonly string[];
  serviceTags?: readonly string[];
  ownerNotes?: string;
}

export interface NormalizedFreelanceOpportunity {
  provider: FreelanceProvider;
  importMode: ImportMode;
  title: string;
  description: string;
  canonicalUrl?: string;
  clientName?: string;
  clientUrl?: string;
  clientCountry?: string;
  clientTimezone?: string;
  budgetType: BudgetType;
  budgetMin?: number;
  budgetMax?: number;
  hourlyMin?: number;
  hourlyMax?: number;
  currency?: string;
  duration?: string;
  timezoneRequirements?: string;
  skills: readonly string[];
  serviceTags: readonly string[];
  ownerNotes?: string;
  fingerprint: string;
  warnings: readonly string[];
}

export interface FreelanceScoreFactors {
  technicalFit: number;
  evidenceStrength: number;
  budgetEconomics: number;
  winProbability: number;
  clientQuality: number;
  strategicValue: number;
  scopeClarity: number;
  deliveryRisk: number;
}

export interface FreelanceOpportunityScore {
  factors: Partial<FreelanceScoreFactors>;
  weights: FreelanceScoreWeights;
  unknownFactors: readonly (keyof FreelanceScoreFactors)[];
  totalScore: number;
  evidenceCoverage: number;
  recommendation: FreelanceRecommendation;
  calculationVersion: "freelance-opportunity-score.v1";
}

export interface PricingRecommendation {
  pricingMode: PricingMode;
  currency: string;
  estimatedHours: number;
  targetEffectiveRate: number;
  riskBufferPercent: number;
  minimumAmount: number;
  recommendedAmount: number;
  premiumAmount: number;
  calculationVersion: "freelance-pricing.v1";
  assumptions: readonly string[];
}

export type FreelanceCrmStatus =
  | "DISCOVERED"
  | "QUALIFIED"
  | "PROPOSAL_DRAFTED"
  | "READY_FOR_REVIEW"
  | "SUBMITTED"
  | "VIEWED"
  | "CLIENT_RESPONDED"
  | "INTERVIEW"
  | "NEGOTIATION"
  | "WON"
  | "LOST"
  | "WITHDRAWN";

export type FreelanceApprovalState =
  | "DRAFT"
  | "READY_FOR_REVIEW"
  | "APPROVED"
  | "SUBMITTED"
  | "DECLINED";

export const FREELANCE_CRM_TRANSITIONS: Readonly<Record<FreelanceCrmStatus, readonly FreelanceCrmStatus[]>> = {
  DISCOVERED: ["QUALIFIED", "WITHDRAWN"],
  QUALIFIED: ["PROPOSAL_DRAFTED", "WITHDRAWN"],
  PROPOSAL_DRAFTED: ["READY_FOR_REVIEW", "WITHDRAWN"],
  READY_FOR_REVIEW: ["SUBMITTED", "PROPOSAL_DRAFTED", "WITHDRAWN"],
  SUBMITTED: ["VIEWED", "CLIENT_RESPONDED", "INTERVIEW", "NEGOTIATION", "WON", "LOST", "WITHDRAWN"],
  VIEWED: ["CLIENT_RESPONDED", "INTERVIEW", "NEGOTIATION", "WON", "LOST", "WITHDRAWN"],
  CLIENT_RESPONDED: ["INTERVIEW", "NEGOTIATION", "WON", "LOST", "WITHDRAWN"],
  INTERVIEW: ["NEGOTIATION", "WON", "LOST", "WITHDRAWN"],
  NEGOTIATION: ["WON", "LOST", "WITHDRAWN"],
  WON: [],
  LOST: [],
  WITHDRAWN: []
};

export const FREELANCE_APPROVAL_TRANSITIONS: Readonly<
  Record<FreelanceApprovalState, readonly FreelanceApprovalState[]>
> = {
  DRAFT: ["READY_FOR_REVIEW", "DECLINED"],
  READY_FOR_REVIEW: ["DRAFT", "APPROVED", "DECLINED"],
  APPROVED: ["SUBMITTED", "DECLINED"],
  SUBMITTED: [],
  DECLINED: ["DRAFT"]
};

export interface ProviderContext {
  connectionId?: string;
  signal?: AbortSignal;
}

export interface ProviderResult {
  provider: string;
  mode: "manual" | "api";
  records: readonly NormalizedFreelanceOpportunity[];
}
