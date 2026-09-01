import type { OwnerRepository } from "./owner";

export function projectionRepository(owner: OwnerRepository) {
  return {
    ...owner,
    resource: "projection" as const,
    async listRules() {
      return owner.client
        .from("portfolio_projection_rules")
        .select("*")
        .eq("owner_id", owner.ownerId);
    }
  };
}
