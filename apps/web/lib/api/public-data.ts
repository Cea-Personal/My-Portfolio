import { createClient } from "@supabase/supabase-js";
import { parsePublicEnv } from "@career-os/config";
import { publicRepository, type PublicPortfolioSnapshot } from "@career-os/database";

export async function loadPublicPortfolio(): Promise<PublicPortfolioSnapshot> {
  try {
    const env = parsePublicEnv();
    const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
    });
    return await publicRepository(client).activePublication();
  } catch {
    // The public experience remains available as an empty, cacheable projection
    // during local development or while Supabase is unavailable.
    return { publication: null, items: [], evidence: [] };
  }
}
