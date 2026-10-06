import type { OpportunityProvider } from "./contract";

const providers = new Map<string, OpportunityProvider>();

export function registerOpportunityProvider(provider: OpportunityProvider): void {
  if (providers.has(provider.provider)) throw new Error("OPPORTUNITY_PROVIDER_ALREADY_REGISTERED");
  providers.set(provider.provider, provider);
}

export function getOpportunityProvider(provider: string): OpportunityProvider {
  const result = providers.get(provider);
  if (!result) throw new Error("OPPORTUNITY_PROVIDER_NOT_FOUND");
  return result;
}

export function listOpportunityProviders(): readonly OpportunityProvider[] {
  return [...providers.values()];
}
