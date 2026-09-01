import { expect, it } from "vitest";
import { createPost, transitionPost } from "@career-os/career";
it("requires explicit confirmation for publication", () => {
  const post = createPost("owner", "A post", "Technical notes");
  expect(() => transitionPost(post, "published")).toThrow();
});
