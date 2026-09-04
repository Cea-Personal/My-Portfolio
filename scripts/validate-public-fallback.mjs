#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const artifactPath = resolve(process.argv[2] ?? "apps/web/public/generated/public-fallback.json");
const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
const fail = (message) => {
  throw new Error(`Invalid public fallback: ${message}`);
};
const record = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const nonEmpty = (value) => typeof value === "string" && value.trim().length > 0;

if (!record(artifact)) fail("root must be an object");
if (artifact.schema_version !== "portfolio-fallback.v1") fail("unsupported schema version");
if (
  !Number.isInteger(artifact.source_publication_version) ||
  artifact.source_publication_version < 1
)
  fail("source publication version must be positive");
if (!nonEmpty(artifact.source_content_hash)) fail("source content hash is required");
if (!nonEmpty(artifact.generated_at) || !Number.isFinite(Date.parse(artifact.generated_at)))
  fail("generated_at must be an ISO date");
if (!nonEmpty(artifact.expires_at) || !Number.isFinite(Date.parse(artifact.expires_at)))
  fail("expires_at must be an ISO date");
if (Date.parse(artifact.expires_at) <= Date.now()) fail("snapshot is expired");
if (!record(artifact.publication) || artifact.publication.status !== "published")
  fail("publication must be published");
if (
  !Array.isArray(artifact.items) ||
  !Array.isArray(artifact.evidence) ||
  !Array.isArray(artifact.blog)
)
  fail("items, evidence, and blog must be arrays");
for (const item of artifact.items) {
  if (
    !record(item) ||
    !nonEmpty(item.public_id) ||
    !nonEmpty(item.source_entity_type) ||
    !nonEmpty(item.section) ||
    !nonEmpty(item.title) ||
    !nonEmpty(item.public_summary)
  )
    fail("every item must be an allowlisted public item");
  if (
    "raw_url" in item ||
    "source_text" in item ||
    "embedding" in item ||
    "private_description" in item
  )
    fail("private/raw fields are not allowed");
}
for (const post of artifact.blog) {
  if (
    !record(post) ||
    !nonEmpty(post.id) ||
    !nonEmpty(post.slug) ||
    !nonEmpty(post.title) ||
    post.supports_employment_claim !== false
  )
    fail("every blog entry must be technical and non-employment evidence");
}
console.log(
  `Validated public fallback ${artifactPath} (publication v${artifact.source_publication_version})`
);
