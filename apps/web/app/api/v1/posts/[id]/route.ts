import { apiResponse } from "@/lib/api/response";
import { withPrivateApi } from "@/lib/api/private";

export function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const { data, error } = await client
      .schema("app")
      .from("posts")
      .select("*, post_versions(*)")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) throw error;
    return apiResponse(data ? { post: data } : null, request, data ? 200 : 404);
  });
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withPrivateApi(request, async ({ client, ownerId }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const existing = await client
      .schema("app")
      .from("posts")
      .select("*")
      .eq("id", id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) return apiResponse(null, request, 404);
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const markdown = typeof body.markdown === "string" ? body.markdown.trim() : "";
    const slug =
      typeof body.slug === "string" ? body.slug.trim().toLowerCase() : existing.data.slug;
    if (!title || !markdown || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
      return apiResponse({ code: "INVALID_POST_VERSION" }, request, 400);
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
    const latest = await client
      .schema("app")
      .from("post_versions")
      .select("version")
      .eq("post_id", id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest.error) throw latest.error;
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(markdown));
    const contentHash = Array.from(new Uint8Array(bytes))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const versionResult = await client
      .schema("app")
      .from("post_versions")
      .insert({
        post_id: id,
        version: Number(latest.data?.version ?? 0) + 1,
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
    if (versionResult.error || !versionResult.data)
      throw versionResult.error ?? new Error("POST_VERSION_CREATE_FAILED");
    const { data, error } = await client
      .schema("app")
      .from("posts")
      .update({
        slug: slug.slice(0, 160),
        current_version_id: versionResult.data.id,
        status: "draft",
        scheduled_at: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .select("*")
      .single();
    if (error) throw error;
    return apiResponse({ post: data, version: versionResult.data }, request);
  });
}
