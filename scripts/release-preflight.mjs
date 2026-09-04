import { access } from "node:fs/promises";
import { constants } from "node:fs";

const requiredEnvironment = [
  "SUPABASE_PROJECT_REF",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_URL",
  "PLAYWRIGHT_BASE_URL",
  "E2E_OWNER_EMAIL",
  "E2E_OWNER_PASSWORD",
  "E2E_NON_OWNER_EMAIL",
  "E2E_NON_OWNER_PASSWORD",
  "GOOGLE_DRIVE_CLIENT_SECRET"
];

const missing = requiredEnvironment.filter((name) => !process.env[name]?.trim());
if (process.env.E2E_ALLOW_MUTATIONS !== "true") missing.push("E2E_ALLOW_MUTATIONS=true");

try {
  const baseUrl = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "");
  if (!/^https?:$/.test(baseUrl.protocol)) throw new Error("unsupported protocol");
} catch {
  missing.push("PLAYWRIGHT_BASE_URL (absolute http(s) URL)");
}

for (const fixture of [
  "supabase/seed/acceptance.sql",
  "tests/evals/public-intelligence/cases.jsonl"
]) {
  try {
    await access(fixture, constants.R_OK);
  } catch {
    missing.push(fixture);
  }
}

if (missing.length) {
  console.error(`Release preflight failed. Missing required gates:\n- ${missing.join("\n- ")}`);
  process.exit(1);
}
