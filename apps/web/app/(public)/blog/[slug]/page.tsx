import { loadPublicPortfolio } from "@/lib/api/public-data";

export const dynamic = "force-dynamic";

export default async function BlogPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const snapshot = await loadPublicPortfolio();
  const post = snapshot.items.find(
    (item) => item.source_entity_type === "post" && item.detail_slug === slug
  );
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
      <h1>{typeof post.title === "string" ? post.title : "Blog"}</h1>
      {typeof post.subtitle === "string" ? <p>{post.subtitle}</p> : null}
      <p>{typeof post.public_summary === "string" ? post.public_summary : ""}</p>
    </main>
  );
}
