import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CookieStore {
  getAll(): Promise<{ name: string; value: string }[]> | { name: string; value: string }[];
  setAll?(
    cookies: { name: string; value: string; options?: Record<string, unknown> }[]
  ): Promise<void> | void;
}

export function createServerSupabaseClient(
  url: string,
  anonKey: string,
  cookies: CookieStore
): SupabaseClient {
  return createServerClient(url, anonKey, {
    db: { schema: "app" },
    cookies: {
      async getAll() {
        return await cookies.getAll();
      },
      async setAll(values) {
        await cookies.setAll?.(values);
      }
    },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  }) as unknown as SupabaseClient;
}
