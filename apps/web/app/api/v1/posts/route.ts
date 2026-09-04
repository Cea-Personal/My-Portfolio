import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export function GET(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { data: posts, error } = await client
      .schema("app")
      .from("posts")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const postIds = (posts ?? []).map((post) => post.id as string);
    const versions = postIds.length
      ? await client
          .schema("app")
          .from("post_versions")
          .select("*")
          .in("post_id", postIds)
          .order("version", { ascending: false })
      : { data: [], error: null };
    if (versions.error) throw versions.error;
    const byId = new Map((versions.data ?? []).map((version) => [version.id, version]));
    return apiResponse(
      {
        posts: (posts ?? []).map((post) => ({
          ...post,
          currentVersion: byId.get(post.current_version_id) ?? null,
          versions: (versions.data ?? []).filter((version) => version.post_id === post.id)
        }))
      },
      request
    );
  });
}
export async function POST(request: Request) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const markdown = typeof body.markdown === "string" ? body.markdown.trim() : "";
    const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
    if (!title || !markdown || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
      return apiResponse(
        { code: "INVALID_POST", detail: "title, content, and a URL-safe slug are required" },
        request,
        400
      );
    const evidenceIds = Array.isArray(body.evidenceIds)
      ? body.evidenceIds.filter((value: unknown): value is string => typeof value === "string")
      : [];
    if (/\b(I led|my role|my team|my work|at [A-Z][\w-]+)\b/i.test(markdown)) {
      if (!evidenceIds.length)
        return apiResponse({ code: "CAREER_CLAIM_EVIDENCE_REQUIRED" }, request, 409);
      const evidence = await client
        .schema("app")
        .from("career_facts")
        .select("id")
        .eq("owner_id", ownerId)
        .eq("verified_by_owner", true)
        .in("review_status", ["approved", "edited_approved"])
        .in("id", evidenceIds);
      if (evidence.error) throw evidence.error;
      if ((evidence.data ?? []).length !== evidenceIds.length)
        return apiResponse({ code: "UNVERIFIED_ARTICLE_EVIDENCE" }, request, 409);
    }
    const { data: post, error } = await client
      .schema("app")
      .from("posts")
      .insert({ owner_id: ownerId, slug: slug.slice(0, 160), status: "draft" })
      .select("*")
      .single();
    if (error || !post) throw error ?? new Error("POST_CREATE_FAILED");
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(markdown));
    const contentHash = Array.from(new Uint8Array(bytes))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const { data: version, error: versionError } = await client
      .schema("app")
      .from("post_versions")
      .insert({
        post_id: post.id,
        version: 1,
        title: title.slice(0, 240),
        excerpt: typeof body.excerpt === "string" ? body.excerpt.trim().slice(0, 500) : "",
        markdown: markdown.slice(0, 200_000),
        content_hash: contentHash,
        evidence_ids: evidenceIds,
        cover_url: typeof body.coverUrl === "string" ? body.coverUrl.trim().slice(0, 2000) : null,
        tags: Array.isArray(body.tags) ? body.tags.slice(0, 30) : [],
        seo_title: typeof body.seoTitle === "string" ? body.seoTitle.trim().slice(0, 240) : null,
        seo_description:
          typeof body.seoDescription === "string" ? body.seoDescription.trim().slice(0, 500) : null
      })
      .select("*")
      .single();
    if (versionError || !version) throw versionError ?? new Error("POST_VERSION_CREATE_FAILED");
    const { data: updated, error: updateError } = await client
      .schema("app")
      .from("posts")
      .update({ current_version_id: version.id, updated_at: new Date().toISOString() })
      .eq("id", post.id)
      .eq("owner_id", ownerId)
      .select("*")
      .single();
    if (updateError || !updated) throw updateError ?? new Error("POST_CREATE_FAILED");
    return apiResponse({ post: { ...updated, currentVersion: version } }, request, 201);
  });
}
