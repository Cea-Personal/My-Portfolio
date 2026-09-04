#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const args = process.argv.slice(2);
const valueFor = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const inputPath = resolve(valueFor("--input", "apps/web/public/generated/public-fallback.json"));
const outputPath = resolve(valueFor("--output", "apps/web/public/generated/public-fallback.json"));
const expiryDays = Number(valueFor("--expiry-days", "180"));
if (!Number.isFinite(expiryDays) || expiryDays <= 0)
  throw new Error("--expiry-days must be positive.");

const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const stringOrNull = (value) => (typeof value === "string" ? value.trim() || null : null);
const stringArray = (value) =>
  Array.isArray(value)
    ? value
        .filter((entry) => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

const source = JSON.parse(readFileSync(inputPath, "utf8"));
const publication = isRecord(source.publication) ? source.publication : null;
if (!publication || publication.status !== "published" || !stringOrNull(publication.id)) {
  throw new Error("A published publication is required to generate the public fallback.");
}
const version = Number(publication.version);
if (!Number.isInteger(version) || version < 1)
  throw new Error("Publication version must be a positive integer.");

const publicPublication = {
  id: stringOrNull(publication.id),
  version,
  status: "published",
  schema_version: stringOrNull(publication.schema_version) ?? "portfolio.v1",
  ...(stringOrNull(publication.display_name)
    ? { display_name: stringOrNull(publication.display_name) }
    : {}),
  ...(stringOrNull(publication.headline) ? { headline: stringOrNull(publication.headline) } : {}),
  ...(stringOrNull(publication.bio) ? { bio: stringOrNull(publication.bio) } : {}),
  ...(stringOrNull(publication.email) ? { email: stringOrNull(publication.email) } : {}),
  ...(stringOrNull(publication.contact_url)
    ? { contact_url: stringOrNull(publication.contact_url) }
    : {}),
  ...(stringOrNull(publication.linkedin_url)
    ? { linkedin_url: stringOrNull(publication.linkedin_url) }
    : {}),
  ...(stringOrNull(publication.github_url)
    ? { github_url: stringOrNull(publication.github_url) }
    : {})
};

const itemKeys = [
  "public_id",
  "source_entity_type",
  "source_entity_id",
  "section",
  "display_order",
  "career_stage",
  "title",
  "subtitle",
  "public_summary",
  "display_metric",
  "display_technologies",
  "sanitized_media",
  "public_citations",
  "detail_slug",
  "company_name",
  "organization_name",
  "period",
  "start_date",
  "end_date"
];

// EngineeringProcesses is a dedicated public section, not a second project
// chapter. Keep Portfolio as Proof as the project record (its detail route is
// useful), but never copy the standalone process narrative into the snapshot.
const standaloneSectionTitles = new Set(["engineering process", "engineering processes"]);

const items = Array.isArray(source.items)
  ? source.items
      .filter(isRecord)
      .filter((item) => {
        const title = typeof item.title === "string" ? item.title.trim().toLowerCase() : "";
        return !standaloneSectionTitles.has(title);
      })
      .map((item) => {
        const sanitized = {};
        for (const key of itemKeys) {
          if (item[key] === undefined || item[key] === null) continue;
          if (key === "display_technologies" && Array.isArray(item[key]))
            sanitized[key] = stringArray(item[key]);
          else if (
            ["sanitized_media", "public_citations"].includes(key) &&
            Array.isArray(item[key])
          )
            sanitized[key] = item[key];
          else if (key === "display_order" && Number.isFinite(Number(item[key])))
            sanitized[key] = Number(item[key]);
          else if (typeof item[key] === "string" && item[key].trim())
            sanitized[key] = item[key].trim();
        }
        return sanitized;
      })
  : [];

const evidence = Array.isArray(source.evidence)
  ? source.evidence.filter(isRecord).map((item) => ({
      public_evidence_id: stringOrNull(item.public_evidence_id),
      safe_title: stringOrNull(item.safe_title),
      issuer: stringOrNull(item.issuer),
      occurred_on: stringOrNull(item.occurred_on),
      sanitized_excerpt: stringOrNull(item.sanitized_excerpt),
      source_location_label: stringOrNull(item.source_location_label),
      evidence_type: stringOrNull(item.evidence_type),
      source_version_hash: stringOrNull(item.source_version_hash)
    }))
  : [];

const blog = Array.isArray(source.blog)
  ? source.blog
      .filter((post) => isRecord(post) && post.supports_employment_claim === false)
      .map((post) => ({
        id: stringOrNull(post.id),
        slug: stringOrNull(post.slug),
        title: stringOrNull(post.title),
        excerpt: stringOrNull(post.excerpt),
        markdown: stringOrNull(post.markdown),
        cover_url: typeof post.cover_url === "string" ? post.cover_url : null,
        tags: stringArray(post.tags),
        seo_title: typeof post.seo_title === "string" ? post.seo_title : null,
        seo_description: typeof post.seo_description === "string" ? post.seo_description : null,
        visible_at: stringOrNull(post.visible_at),
        evidence_type: "technical_knowledge",
        supports_employment_claim: false
      }))
      .filter(
        (post) =>
          post.id && post.slug && post.title && post.excerpt && post.markdown && post.visible_at
      )
  : [];

const canonical = JSON.stringify({ publication: publicPublication, items, evidence, blog });
const generatedAt = new Date().toISOString();
const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();
const output = {
  schema_version: "portfolio-fallback.v1",
  source_publication_version: version,
  source_content_hash:
    stringOrNull(publication.content_hash) ?? createHash("sha256").update(canonical).digest("hex"),
  generated_at: generatedAt,
  expires_at: expiresAt,
  publication: publicPublication,
  items,
  evidence,
  blog
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Generated ${outputPath} from publication ${publicPublication.id} v${version}`);
