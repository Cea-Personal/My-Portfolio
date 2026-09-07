import { createServiceSupabaseClient } from "@career-os/database/service";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * AI provider metadata is deliberately hidden from authenticated database
 * clients. Server-side inference paths therefore resolve provider and
 * capability records through the service role after the API boundary has
 * already authenticated and authorized the owner.
 */
export function aiRuntimeClient(fallback: SupabaseClient): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceRoleKey ? createServiceSupabaseClient(url, serviceRoleKey) : fallback;
}
