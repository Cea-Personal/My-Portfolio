import type {
  ManualOpportunityInput,
  NormalizedFreelanceOpportunity,
  ProviderContext,
  ProviderResult
} from "../types";

export type OpportunityProviderCapability = "manual_import" | "oauth" | "api_fetch" | "api_submit";

export class ProviderCapabilityError extends Error {
  constructor(readonly code: "PROVIDER_CAPABILITY_DISABLED" | "UPWORK_CONNECTION_REQUIRED") {
    super(code);
    this.name = "ProviderCapabilityError";
  }
}

export interface OpportunityProvider {
  readonly provider: string;
  readonly version: string;
  readonly capabilities: readonly OpportunityProviderCapability[];
  readonly plannedCapabilities?: readonly OpportunityProviderCapability[];
  importManual(input: ManualOpportunityInput): NormalizedFreelanceOpportunity;
  fetchOpportunities(context: ProviderContext): Promise<ProviderResult>;
  getOpportunity(externalId: string, context: ProviderContext): Promise<ProviderResult>;
  normalize(record: unknown): NormalizedFreelanceOpportunity;
}
