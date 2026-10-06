import { normalizeManualOpportunity } from "../normalization";
import type { ManualOpportunityInput, ProviderContext, ProviderResult } from "../types";
import { ProviderCapabilityError, type OpportunityProvider } from "./contract";
import { registerOpportunityProvider } from "./registry";

export class UpworkProvider implements OpportunityProvider {
  readonly provider = "upwork";
  readonly version = "upwork-provider.v1";
  readonly capabilities = ["manual_import"] as const;
  readonly plannedCapabilities = ["oauth", "api_fetch"] as const;

  importManual(input: ManualOpportunityInput) {
    return normalizeManualOpportunity({ ...input, provider: "upwork" });
  }

  async fetchOpportunities(context: ProviderContext): Promise<ProviderResult> {
    if (!context.connectionId) throw new ProviderCapabilityError("UPWORK_CONNECTION_REQUIRED");
    throw new ProviderCapabilityError("PROVIDER_CAPABILITY_DISABLED");
  }

  async getOpportunity(externalId: string, context: ProviderContext): Promise<ProviderResult> {
    if (!externalId.trim()) throw new Error("UPWORK_EXTERNAL_ID_REQUIRED");
    if (!context.connectionId) throw new ProviderCapabilityError("UPWORK_CONNECTION_REQUIRED");
    throw new ProviderCapabilityError("PROVIDER_CAPABILITY_DISABLED");
  }

  normalize(record: unknown) {
    if (!record || typeof record !== "object") throw new Error("UPWORK_RECORD_INVALID");
    const input = record as Partial<ManualOpportunityInput>;
    return this.importManual({
      provider: "upwork",
      title: input.title ?? "",
      description: input.description ?? "",
      ...(input.url ? { url: input.url } : {}),
      ...(input.clientName ? { clientName: input.clientName } : {}),
      ...(input.budgetType ? { budgetType: input.budgetType } : {}),
      ...(input.budgetMin !== undefined ? { budgetMin: input.budgetMin } : {}),
      ...(input.budgetMax !== undefined ? { budgetMax: input.budgetMax } : {}),
      ...(input.hourlyMin !== undefined ? { hourlyMin: input.hourlyMin } : {}),
      ...(input.hourlyMax !== undefined ? { hourlyMax: input.hourlyMax } : {}),
      ...(input.currency ? { currency: input.currency } : {}),
      ...(input.duration ? { duration: input.duration } : {}),
      ...(input.skills ? { skills: input.skills } : {})
    });
  }
}

export const upworkProvider = new UpworkProvider();
registerOpportunityProvider(upworkProvider);
