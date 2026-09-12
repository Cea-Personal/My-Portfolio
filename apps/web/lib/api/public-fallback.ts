import artifact from "@/public/generated/public-fallback.json";
import type { PublicPortfolioSnapshot } from "@career-os/database";
import { expandTechnologyLabels, expandTechnologyTerms } from "@/lib/portfolio-career-rules";

export interface PublicBlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  markdown: string;
  cover_url: string | null;
  tags: string[];
  seo_title: string | null;
  seo_description: string | null;
  visible_at: string;
  evidence_type: "technical_knowledge";
  supports_employment_claim: false;
}

export interface PublicFallbackArtifact extends PublicPortfolioSnapshot {
  schema_version: "portfolio-fallback.v1";
  source_publication_version: number;
  source_content_hash: string;
  generated_at: string;
  expires_at: string;
  blog: PublicBlogPost[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

function validatePublication(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  if (!isString(value.id) || value.status !== "published") return null;
  if (typeof value.version !== "number" || !Number.isInteger(value.version)) return null;
  const safe: Record<string, unknown> = {
    id: value.id,
    version: value.version,
    status: "published"
  };
  for (const key of [
    "schema_version",
    "display_name",
    "headline",
    "bio",
    "email",
    "contact_url",
    "linkedin_url",
    "github_url"
  ]) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) safe[key] = candidate;
  }
  return safe;
}

function validateItem(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  if (!isString(value.public_id) || !isString(value.source_entity_type)) return null;
  if (!isString(value.source_entity_id) || !isString(value.section)) return null;
  if (!isString(value.title) || !isString(value.public_summary)) return null;
  const safe: Record<string, unknown> = {
    public_id: value.public_id,
    source_entity_type: value.source_entity_type,
    source_entity_id: value.source_entity_id,
    section: value.section,
    title: value.title,
    public_summary: value.public_summary,
    display_order: typeof value.display_order === "number" ? value.display_order : 0
  };
  for (const key of [
    "subtitle",
    "display_metric",
    "detail_slug",
    "career_stage",
    "company_name",
    "organization_name",
    "period",
    "start_date",
    "end_date"
  ]) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) safe[key] = candidate;
  }
  if (isStringArray(value.display_technologies))
    safe.display_technologies = value.display_technologies;
  if (Array.isArray(value.sanitized_media)) safe.sanitized_media = value.sanitized_media;
  if (Array.isArray(value.public_citations)) safe.public_citations = value.public_citations;
  if (isRecord(value.structured_content)) safe.structured_content = value.structured_content;
  return safe;
}

function validateEvidence(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  if (!isString(value.public_evidence_id) || !isString(value.sanitized_excerpt)) return null;
  const safe: Record<string, unknown> = {
    public_evidence_id: value.public_evidence_id,
    sanitized_excerpt: value.sanitized_excerpt
  };
  for (const key of [
    "safe_title",
    "issuer",
    "occurred_on",
    "source_location_label",
    "evidence_type",
    "source_version_hash"
  ]) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) safe[key] = candidate;
  }
  return safe;
}

export function parsePublicBlogPost(value: unknown): PublicBlogPost | null {
  if (!isRecord(value)) return null;
  if (
    !isString(value.id) ||
    !isString(value.slug) ||
    !isString(value.title) ||
    !isString(value.excerpt) ||
    !isString(value.markdown) ||
    !isNullableString(value.cover_url) ||
    !isStringArray(value.tags) ||
    !isNullableString(value.seo_title) ||
    !isNullableString(value.seo_description) ||
    !isString(value.visible_at) ||
    value.evidence_type !== "technical_knowledge" ||
    value.supports_employment_claim !== false
  )
    return null;
  return {
    id: value.id,
    slug: value.slug,
    title: expandTechnologyTerms(value.title),
    excerpt: expandTechnologyTerms(value.excerpt),
    markdown: expandTechnologyTerms(value.markdown),
    cover_url: value.cover_url,
    tags: expandTechnologyLabels(value.tags),
    seo_title: value.seo_title ? expandTechnologyTerms(value.seo_title) : null,
    seo_description: value.seo_description ? expandTechnologyTerms(value.seo_description) : null,
    visible_at: value.visible_at,
    evidence_type: "technical_knowledge",
    supports_employment_claim: false
  };
}

export function parsePublicFallbackArtifact(value: unknown): PublicFallbackArtifact | null {
  if (!isRecord(value)) return null;
  if (
    value.schema_version !== "portfolio-fallback.v1" ||
    typeof value.source_publication_version !== "number" ||
    !Number.isInteger(value.source_publication_version) ||
    value.source_publication_version < 1 ||
    !isString(value.source_content_hash) ||
    !isString(value.generated_at) ||
    !isString(value.expires_at) ||
    !Number.isFinite(Date.parse(value.generated_at)) ||
    !Number.isFinite(Date.parse(value.expires_at)) ||
    Date.parse(value.expires_at) <= Date.parse(value.generated_at)
  )
    return null;
  const publication = validatePublication(value.publication);
  if (!publication) return null;
  if (!Array.isArray(value.items) || !Array.isArray(value.evidence) || !Array.isArray(value.blog))
    return null;
  const items = value.items.map(validateItem);
  const evidence = value.evidence.map(validateEvidence);
  const blog = value.blog.map(parsePublicBlogPost);
  if (items.some((item) => !item) || evidence.some((entry) => !entry) || blog.some((post) => !post))
    return null;
  return {
    schema_version: "portfolio-fallback.v1",
    source_publication_version: value.source_publication_version,
    source_content_hash: value.source_content_hash,
    generated_at: value.generated_at,
    expires_at: value.expires_at,
    publication,
    items: items.filter((item): item is Record<string, unknown> => item !== null),
    evidence: evidence.filter((entry): entry is Record<string, unknown> => entry !== null),
    blog: blog.filter((post): post is PublicBlogPost => post !== null)
  };
}

export function readPublicFallbackArtifact(): PublicFallbackArtifact | null {
  const parsed = parsePublicFallbackArtifact(artifact);
  if (!parsed || Date.parse(parsed.expires_at) <= Date.now()) return null;
  return parsed;
}

export function fallbackPortfolioSnapshot(): PublicPortfolioSnapshot | null {
  const parsed = readPublicFallbackArtifact();
  if (!parsed) return null;
  return {
    publication: parsed.publication,
    items: parsed.items,
    evidence: parsed.evidence
  };
}

export function fallbackBlogPosts(): PublicBlogPost[] {
  return readPublicFallbackArtifact()?.blog ?? [];
}
