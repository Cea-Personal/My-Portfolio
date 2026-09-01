import type { SupabaseClient } from "@supabase/supabase-js";

export function workflowRepository(
  client: SupabaseClient,
  workflowId: string
): { scope: "workflow"; client: SupabaseClient; workflowId: string } {
  if (!workflowId) throw new Error("workflowId is required");
  return { scope: "workflow", client, workflowId };
}
