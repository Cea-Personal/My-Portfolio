import { ResourceList } from "@/components/dashboard/resource-list";

export default function BlogPage() {
  return (
    <ResourceList
      endpoint="/api/v1/posts"
      collectionKey="posts"
      title="Blog"
      description="Draft, review, and publish evidence-backed technical articles."
      emptyText="No articles yet."
    />
  );
}
