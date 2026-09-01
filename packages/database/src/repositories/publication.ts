import type { SupabaseClient } from "@supabase/supabase-js";

export function publicationRepository(client: SupabaseClient) {
  return {
    scope: "public" as const,
    async active(ownerId?: string) {
      let query = client
        .schema("published")
        .from("portfolio_publications")
        .select("*, portfolio_items(*)")
        .eq("status", "published");
      if (ownerId) query = query.eq("owner_id", ownerId);
      return query.maybeSingle();
    },
    async evidence(id: string) {
      return client
        .schema("published")
        .from("public_evidence")
        .select("*")
        .eq("public_evidence_id", id)
        .maybeSingle();
    }
  };
}
