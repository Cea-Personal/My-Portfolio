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

export interface PublicBlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  markdown: string;
  cover_url: string | null;
  tags: string[];
  seo_title: string | null;
  seo_description: string | null;
  visible_at: string;
  evidence_type: "technical_knowledge";
  supports_employment_claim: false;
}

function publicClient() {
  const env = parsePublicEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
}

export async function loadPublicBlogPosts(): Promise<PublicBlogPost[]> {
  try {
    const { data, error } = await publicClient()
      .schema("published")
      .from("blog_posts")
      .select(
        "id,slug,title,excerpt,markdown,cover_url,tags,seo_title,seo_description,visible_at,evidence_type,supports_employment_claim"
      )
      .order("visible_at", { ascending: false });
    if (error) throw error;
    return data as PublicBlogPost[];
  } catch {
    return [];
  }
}

export async function loadPublicBlogPost(slug: string): Promise<PublicBlogPost | null> {
  try {
    const { data, error } = await publicClient()
      .schema("published")
      .from("blog_posts")
      .select(
        "id,slug,title,excerpt,markdown,cover_url,tags,seo_title,seo_description,visible_at,evidence_type,supports_employment_claim"
      )
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    return (data as PublicBlogPost | null) ?? null;
  } catch {
    return null;
  }
}
