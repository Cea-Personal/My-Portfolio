/**
 * Resolve a YouTube URL into a privacy-enhanced, embeddable URL.
 *
 * Project media is public projection data, so we deliberately accept only
 * YouTube hosts and an 11-character video id. This prevents an arbitrary
 * `sanitized_media` value from becoming an iframe source.
 */
export function youtubeEmbedUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "youtube.com" && host !== "youtu.be" && host !== "youtube-nocookie.com") {
    return null;
  }

  let id = "";
  if (host === "youtu.be") {
    id = url.pathname.split("/").filter(Boolean)[0] ?? "";
  } else if (url.pathname === "/watch") {
    id = url.searchParams.get("v") ?? "";
  } else {
    const parts = url.pathname.split("/").filter(Boolean);
    const marker = parts[0];
    if (marker === "embed" || marker === "shorts" || marker === "live") id = parts[1] ?? "";
  }
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
}

function mediaValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Record<string, unknown>;
  for (const key of ["youtubeUrl", "videoUrl", "url", "href", "src"]) {
    if (typeof record[key] === "string") return record[key];
  }
  return "";
}

/** Find the first YouTube demo in published media or structured project data. */
export function projectYoutubeEmbedUrl(media: unknown, structuredContent?: unknown): string | null {
  const candidates: unknown[] = Array.isArray(media)
    ? Array.from(media as readonly unknown[])
    : [];
  if (structuredContent && typeof structuredContent === "object") {
    const structured = structuredContent as Record<string, unknown>;
    candidates.push(structured.youtubeUrl, structured.videoUrl, structured.url, structured.links);
  }
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      for (const nested of candidate) {
        const embed = youtubeEmbedUrl(mediaValue(nested));
        if (embed) return embed;
      }
      continue;
    }
    const embed = youtubeEmbedUrl(mediaValue(candidate));
    if (embed) return embed;
  }
  return null;
}
