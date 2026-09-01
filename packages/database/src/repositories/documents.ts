import type { OwnerRepository } from "./owner";

export function documentsRepository(owner: OwnerRepository) {
  return {
    ...owner,
    resource: "documents" as const,
    async list() {
      return owner.client.from("documents").select("*").eq("owner_id", owner.ownerId);
    }
  };
}
