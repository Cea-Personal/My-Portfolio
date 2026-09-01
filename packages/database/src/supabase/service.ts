import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export function createServiceSupabaseClient(url: string, serviceRoleKey: string): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    db: { schema: "app" },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  }) as unknown as SupabaseClient;
}
