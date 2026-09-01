import type { OwnerRepository } from "./owner";

export function careerRepository(owner: OwnerRepository) {
  return {
    ...owner,
    resource: "career" as const,
    async listFacts() {
      return owner.client.from("career_facts").select("*").eq("owner_id", owner.ownerId);
    }
  };
}
