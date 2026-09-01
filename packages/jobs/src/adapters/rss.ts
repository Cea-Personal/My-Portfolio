import { fetchSourceText, type JobSourceAdapter } from "./registry";

function feedCompany(endpoint: string | undefined): string {
  if (!endpoint) return "RSS source";
  try {
    return new URL(endpoint).hostname.replace(/^www\./i, "") || "RSS source";
  } catch {
    return "RSS source";
  }
}

export const rssAdapter: JobSourceAdapter = {
  type: "rss",
  version: "v1",
  capabilities: ["collect"],
  async collect(input) {
    const xml = await fetchSourceText(input);
    const fallbackCompany = feedCompany(input.endpoint);
    return [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map((match, index) => {
      const value = (tag: string) =>
        match[0]
          ?.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1]
          ?.replace(/<!\[CDATA\[|\]\]>/g, "")
          ?.replace(/<[^>]+>/g, " ")
          .trim() ?? "";
      return {
        externalId: value("guid") || value("link") || `rss-${index}`,
        company: value("author") || value("dc:creator") || fallbackCompany,
        title: value("title"),
        canonicalUrl: value("link"),
        description: value("description")
      };
    });
  }
};
