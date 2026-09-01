import { transitionPost, type Post } from "./posts";

export function publishPost(post: Post, confirmed: boolean): Post {
  return transitionPost(post, "published", confirmed);
}

export function archivePost(post: Post, confirmed: boolean): Post {
  return transitionPost(post, "archived", confirmed);
}
