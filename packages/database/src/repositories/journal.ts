import type { SupabaseClient } from "@supabase/supabase-js";

export function journalRepository(client: SupabaseClient, ownerId: string) {
  return {
    listEntries() {
      return client
        .from("journal_entries")
        .select("*")
        .eq("owner_id", ownerId)
        .is("deleted_at", null);
    },
    createEntry(payload: Record<string, unknown>) {
      return client
        .from("journal_entries")
        .insert({ ...payload, owner_id: ownerId })
        .select()
        .single();
    }
  };
}
