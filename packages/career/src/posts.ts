export type PostStatus = "draft" | "scheduled" | "published" | "archived";
export interface Post {
  id: string;
  ownerId: string;
  slug: string;
  title: string;
  status: PostStatus;
  version: number;
  content: string;
}
const transitions: Record<PostStatus, readonly PostStatus[]> = {
  draft: ["scheduled", "published", "archived"],
  scheduled: ["published", "draft", "archived"],
  published: ["archived"],
  archived: []
};
export function createPost(ownerId: string, title: string, content: string): Post {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) throw new Error("POST_SLUG_REQUIRED");
  return { id: crypto.randomUUID(), ownerId, slug, title, status: "draft", version: 1, content };
}
export function transitionPost(post: Post, status: PostStatus, confirmed = false): Post {
  if (["published", "archived"].includes(status) && !confirmed)
    throw new Error("OWNER_CONFIRMATION_REQUIRED");
  if (!transitions[post.status].includes(status)) throw new Error("INVALID_POST_TRANSITION");
  return { ...post, status, version: post.version + 1 };
}
