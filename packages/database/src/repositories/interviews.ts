import type { SupabaseClient } from "@supabase/supabase-js";

export function interviewRepository(client: SupabaseClient, ownerId: string) {
  return {
    listProcesses() {
      return client.from("interview_processes").select("*").eq("owner_id", ownerId);
    },
    listStages(processId: string) {
      return client.from("interview_stages").select("*").eq("process_id", processId);
    }
  };
}
