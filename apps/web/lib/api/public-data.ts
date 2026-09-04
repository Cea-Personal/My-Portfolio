import { createClient } from "@supabase/supabase-js";
import { parsePublicEnv } from "@career-os/config";
import { publicRepository, type PublicPortfolioSnapshot } from "@career-os/database";
import {
  fallbackBlogPosts,
  fallbackPortfolioSnapshot,
  parsePublicBlogPost,
  type PublicBlogPost
} from "./public-fallback";

export type PublicReadSource = "live" | "fallback" | "empty" | "error";

export interface PublicPortfolioReadResult extends PublicPortfolioSnapshot {
  source: PublicReadSource;
  stale: boolean;
  failure?: "unavailable" | "invalid";
}

export interface PublicBlogReadResult {
  posts: PublicBlogPost[];
  source: PublicReadSource;
  stale: boolean;
  failure?: "unavailable" | "invalid";
}

export interface PublicBlogPostReadResult {
  post: PublicBlogPost | null;
  source: PublicReadSource;
  stale: boolean;
}

const PUBLIC_READ_TIMEOUT_MS = 3_500;

const emptyPortfolio = (
  source: PublicReadSource,
  failure?: PublicPortfolioReadResult["failure"]
): PublicPortfolioReadResult => ({
  publication: null,
  items: [],
  evidence: [],
  source,
  stale: false,
  ...(failure ? { failure } : {})
});

function classifyReadFailure(error: unknown): "unavailable" | "invalid" {
  return error instanceof Error && /invalid/i.test(error.message) ? "invalid" : "unavailable";
}

export function resolvePublicPortfolioRead(
  live: PublicPortfolioSnapshot
): PublicPortfolioReadResult {
  if (!live.publication) return { ...live, source: "empty", stale: false };
  return { ...live, source: "live", stale: false };
}

function publicClient() {
  const env = parsePublicEnv();
  const fetchWithTimeout: typeof fetch = async (input, init) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, PUBLIC_READ_TIMEOUT_MS);
    const upstreamSignal = init?.signal;
    if (upstreamSignal) {
      if (upstreamSignal.aborted) controller.abort();
      else
        upstreamSignal.addEventListener(
          "abort",
          () => {
            controller.abort();
          },
          { once: true }
        );
    }
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  };
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { fetch: fetchWithTimeout }
  });
}

export async function loadPublicPortfolio(): Promise<PublicPortfolioReadResult> {
  try {
    const live = await publicRepository(publicClient()).activePublication();
    return resolvePublicPortfolioRead(live);
  } catch (error) {
    const fallback = fallbackPortfolioSnapshot();
    const failure = classifyReadFailure(error);
    if (fallback) return { ...fallback, source: "fallback", stale: true, failure };
    return emptyPortfolio("error", failure);
  }
}

export async function loadPublicBlogPostsWithStatus(): Promise<PublicBlogReadResult> {
  try {
    const { data, error } = await publicClient()
      .schema("published")
      .from("blog_posts")
      .select(
        "id,slug,title,excerpt,markdown,cover_url,tags,seo_title,seo_description,visible_at,evidence_type,supports_employment_claim"
      )
      .order("visible_at", { ascending: false });
    if (error) throw error;
    const posts = (data as unknown[]).map(parsePublicBlogPost);
    if (posts.some((post) => !post)) throw new Error("PUBLIC_BLOG_RESPONSE_INVALID");
    return {
      posts: posts.filter((post): post is PublicBlogPost => post !== null),
      source: "live",
      stale: false
    };
  } catch (error) {
    const posts = fallbackBlogPosts();
    const failure = classifyReadFailure(error);
    if (posts.length) return { posts, source: "fallback", stale: true, failure };
    return { posts: [], source: "error", stale: false, failure };
  }
}

export async function loadPublicBlogPosts(): Promise<PublicBlogPost[]> {
  return (await loadPublicBlogPostsWithStatus()).posts;
}

export async function loadPublicBlogPostWithStatus(
  slug: string
): Promise<PublicBlogPostReadResult> {
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
    const post = data ? parsePublicBlogPost(data) : null;
    if (data && !post) throw new Error("PUBLIC_BLOG_RESPONSE_INVALID");
    return { post, source: "live", stale: false };
  } catch {
    const post = fallbackBlogPosts().find((candidate) => candidate.slug === slug) ?? null;
    return { post, source: post ? "fallback" : "error", stale: Boolean(post) };
  }
}

export async function loadPublicBlogPost(slug: string): Promise<PublicBlogPost | null> {
  return (await loadPublicBlogPostWithStatus(slug)).post;
}
