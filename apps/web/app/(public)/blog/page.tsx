import { PortfolioNavigation } from "@/components/portfolio/navigation";
import { loadPublicBlogPostsWithStatus } from "@/lib/api/public-data";

export const dynamic = "force-dynamic";

export default async function PublicBlogIndex() {
  const result = await loadPublicBlogPostsWithStatus();
  const posts = result.posts;
  return (
    <>
      <PortfolioNavigation />
      {result.stale ? (
        <p className="portfolio-stale-notice" role="status">
          Showing the latest approved writing snapshot while live content reconnects.
        </p>
      ) : null}
      <main id="main-content" className="portfolio-main blog-index-page">
        <header>
          <p className="eyebrow">Basil Ogbonna · Blog</p>
          <h1>Notes from making solutions people actually use.</h1>
        </header>
        {posts.length ? (
          <ol className="writing-index">
            {posts.map((post, index) => (
              <li key={post.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <p>{new Date(post.visible_at).toLocaleDateString()}</p>
                  <h2>
                    <a href={`/blog/${encodeURIComponent(post.slug)}`}>{post.title}</a>
                  </h2>
                  <span>{post.excerpt}</span>
                </div>
                <a href={`/blog/${encodeURIComponent(post.slug)}`}>Read ↗</a>
              </li>
            ))}
          </ol>
        ) : (
          <p>No articles are published yet.</p>
        )}
      </main>
    </>
  );
}
