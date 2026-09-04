import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";

const databaseUrl = process.env.SUPABASE_DB_URL?.trim();
if (!databaseUrl) {
  console.error(
    "Hosted pgTAP failed: SUPABASE_DB_URL is required for an isolated staging project."
  );
  process.exit(1);
}

let connection;
try {
  const parsed = new URL(databaseUrl);
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("unsupported protocol");
  }
  connection = {
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || "5432",
    PGDATABASE: parsed.pathname.slice(1) || "postgres",
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password)
  };
} catch {
  console.error("Hosted pgTAP failed: SUPABASE_DB_URL must be a PostgreSQL connection URL.");
  process.exit(1);
}

const testsDirectory = resolve("supabase/tests");
const testFiles = (await readdir(testsDirectory))
  .filter((file) => file.endsWith(".test.sql"))
  .sort()
  .map((file) => join(testsDirectory, file));

if (testFiles.length === 0) {
  console.error("Hosted pgTAP failed: no SQL test files were found in supabase/tests.");
  process.exit(1);
}

for (const file of testFiles) {
  const exitCode = await new Promise((resolveCode, reject) => {
    const child = spawn("psql", ["--no-psqlrc", "--set=ON_ERROR_STOP=1", "--file", file], {
      env: {
        ...process.env,
        ...connection,
        PGCONNECT_TIMEOUT: process.env.PGCONNECT_TIMEOUT ?? "15",
        PGSSLMODE: process.env.PGSSLMODE ?? "require"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) return resolveCode(1);
      // psql exits zero when pgTAP assertions return `not ok`; treat those
      // assertion failures as a failed hosted gate rather than a false pass.
      if (code !== 0 || /(^|\n)not ok\b/i.test(stdout)) return resolveCode(1);
      resolveCode(code ?? 1);
    });
  }).catch((error) => {
    console.error(
      `Hosted pgTAP could not start psql: ${error instanceof Error ? error.message : error}`
    );
    return 1;
  });

  if (exitCode !== 0) {
    console.error(`Hosted pgTAP failed in ${file}`);
    process.exit(exitCode);
  }
}

console.log(`Hosted pgTAP passed: ${testFiles.length} SQL files`);
