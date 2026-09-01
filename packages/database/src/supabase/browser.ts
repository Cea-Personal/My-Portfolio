import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export function createBrowserSupabaseClient(url: string, anonKey: string): SupabaseClient {
  return createBrowserClient(url, anonKey, { db: { schema: "app" } }) as unknown as SupabaseClient;
}
