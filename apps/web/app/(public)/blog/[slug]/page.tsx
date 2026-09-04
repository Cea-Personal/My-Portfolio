import { ArticleBody } from "@/components/portfolio/article-body";
import { loadPublicBlogPost } from "@/lib/api/public-data";
import { PublicEvents } from "@/components/analytics/public-events";

export const dynamic = "force-dynamic";

export default async function BlogPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await loadPublicBlogPost(slug);
  if (!post) {
    return (
      <main>
        <h1>Blog post unavailable</h1>
        <p>This article is not part of the active public projection.</p>
      </main>
    );
  }
  return (
    <main>
      <PublicEvents name="article_view" properties={{ article: post.slug }} />
      <a href="/blog">← All articles</a>
      <h1>{post.title}</h1>
      <p>{post.excerpt}</p>
      <p>
        {new Date(post.visible_at).toLocaleDateString()} · {post.tags.join(" · ")}
      </p>
      <ArticleBody markdown={post.markdown} />
      <small>Technical knowledge; not independent proof of professional employment.</small>
    </main>
  );
}
