import type { SupabaseClient } from "@supabase/supabase-js";

export interface OwnerRepository {
  readonly scope: "owner";
  readonly client: SupabaseClient;
  readonly ownerId: string;
}

export function ownerRepository(client: SupabaseClient, ownerId: string): OwnerRepository {
  if (!ownerId) throw new Error("ownerId is required");
  return { scope: "owner", client, ownerId };
}
