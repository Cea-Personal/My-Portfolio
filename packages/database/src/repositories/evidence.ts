import type { OwnerRepository } from "./owner";

export function evidenceRepository(owner: OwnerRepository) {
  return {
    ...owner,
    resource: "evidence" as const,
    async listSources() {
      return owner.client.from("evidence_sources").select("*").eq("owner_id", owner.ownerId);
    }
  };
}
