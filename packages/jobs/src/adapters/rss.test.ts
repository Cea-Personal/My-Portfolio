import { describe, expect, it } from "vitest";
import { rssAdapter } from "./rss";

describe("rss adapter", () => {
  it("normalizes feed authors and falls back to the feed host", async () => {
    const fetcher: typeof fetch = async () =>
      new Response(
        `<rss><channel><item><guid>1</guid><title>Platform Engineer</title><link>https://jobs.example.test/1</link><description><![CDATA[<p>Build reliable systems</p>]]></description><dc:creator>Example Labs</dc:creator></item><item><guid>2</guid><title>Product Engineer</title></item></channel></rss>`
      );
    const records = await rssAdapter.collect({
      endpoint: "https://jobs.example.test/feed.xml",
      fetcher
    });
    expect(records).toEqual([
      expect.objectContaining({ company: "Example Labs", title: "Platform Engineer" }),
      expect.objectContaining({ company: "jobs.example.test", title: "Product Engineer" })
    ]);
  });
});
