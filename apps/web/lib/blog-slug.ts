export function slugifyBlogTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150);
}

export function uniqueBlogSlug(base: string, existing: string[], current?: string): string {
  const taken = new Set(existing.filter((slug) => slug !== current));
  const root = base || "post";
  if (!taken.has(root)) return root;
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = `${root.slice(0, 150 - String(suffix).length - 1)}-${String(suffix)}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("BLOG_SLUG_UNAVAILABLE");
}
