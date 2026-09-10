import { describe, expect, it } from "vitest";
import { projectYoutubeEmbedUrl, youtubeEmbedUrl } from "./portfolio-media";

describe("portfolio YouTube media", () => {
  it("normalizes supported YouTube URL shapes", () => {
    expect(youtubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0"
    );
    expect(youtubeEmbedUrl("https://youtu.be/dQw4w9WgXcQ?t=12")).toContain(
      "/embed/dQw4w9WgXcQ?rel=0"
    );
  });

  it("rejects arbitrary hosts and finds links in structured project data", () => {
    expect(youtubeEmbedUrl("https://example.com/video")).toBeNull();
    expect(
      projectYoutubeEmbedUrl([], { links: [{ type: "youtube", url: "https://youtu.be/dQw4w9WgXcQ" }] })
    ).toContain("/embed/dQw4w9WgXcQ?rel=0");
  });
});
