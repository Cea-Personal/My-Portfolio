#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const artifactPath = resolve(process.argv[2] ?? "apps/web/public/generated/public-fallback.json");
const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
if (!artifact || typeof artifact !== "object" || Array.isArray(artifact))
  throw new Error("Cannot invalidate an invalid public fallback artifact.");

artifact.expires_at = new Date(0).toISOString();
artifact.invalidated_at = new Date().toISOString();
writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`Invalidated public fallback ${artifactPath}; regenerate it before the next release.`);
