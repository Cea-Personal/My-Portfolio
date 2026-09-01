import type { SupabaseClient } from "@supabase/supabase-js";
export function automationRepository(client: SupabaseClient, ownerId: string) {
  return {
    async byCorrelation(correlationId: string) {
      return client
        .from("automation_runs")
        .select("*, automation_run_steps(*)")
        .eq("owner_id", ownerId)
        .eq("correlation_id", correlationId);
    }
  };
}
