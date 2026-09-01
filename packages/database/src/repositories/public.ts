import type { SupabaseClient } from "@supabase/supabase-js";

export interface PublicPortfolioSnapshot {
  publication: Record<string, unknown> | null;
  items: Record<string, unknown>[];
  evidence: Record<string, unknown>[];
}

export function publicRepository(client: SupabaseClient) {
  return {
    scope: "public" as const,
    client,
    async activePublication(): Promise<PublicPortfolioSnapshot> {
      const [publicationResult, itemsResult] = await Promise.all([
        client.schema("api").from("current_publication").select("*").maybeSingle(),
        client.schema("api").from("public_portfolio_items").select("*").order("display_order")
      ]);
      if (publicationResult.error || itemsResult.error || !publicationResult.data)
        return { publication: null, items: [], evidence: [] };
      const evidenceResult = await client
        .schema("published")
        .from("public_evidence")
        .select("*")
        .eq("publication_id", publicationResult.data.id);
      return {
        publication: publicationResult.data as Record<string, unknown>,
        items: (itemsResult.data ?? []) as Record<string, unknown>[],
        evidence: (evidenceResult.data ?? []) as Record<string, unknown>[]
      };
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
