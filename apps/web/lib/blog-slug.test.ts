import { describe, expect, it } from "vitest";
import { slugifyBlogTitle, uniqueBlogSlug } from "./blog-slug";

describe("blog slugs", () => {
  it("derives a URL-safe slug from the title", () => {
    expect(slugifyBlogTitle("Building reliable Data & AI systems")).toBe(
      "building-reliable-data-ai-systems"
    );
  });

  it("adds a suffix for a duplicate title", () => {
    expect(uniqueBlogSlug("building-reliable-systems", ["building-reliable-systems"])).toBe(
      "building-reliable-systems-2"
    );
    expect(
      uniqueBlogSlug("building-reliable-systems", [
        "building-reliable-systems",
        "building-reliable-systems-2"
      ])
    ).toBe("building-reliable-systems-3");
  });
});
