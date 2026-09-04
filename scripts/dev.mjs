import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, dirname, resolve } from "node:path";

const candidates = [
  process.env.CAREER_OS_NODE_BINARY,
  process.execPath,
  "/opt/homebrew/opt/node@24/bin/node",
  "/usr/local/opt/node@24/bin/node"
].filter(Boolean);

const nodeBinary = candidates.find((candidate) => {
  if (!existsSync(candidate)) return false;
  try {
    const version = execFileSync(candidate, ["--version"], { encoding: "utf8" }).trim();
    return /^v24\./.test(version);
  } catch {
    return false;
  }
});

if (!nodeBinary) {
  console.error(
    "Node 24 is required. Install it with `brew install node@24`, or set CAREER_OS_NODE_BINARY to a Node 24 executable."
  );
  process.exit(1);
}

const turbo = resolve(process.cwd(), "node_modules/turbo/bin/turbo");
if (!existsSync(turbo)) {
  console.error("Turbo is not installed. Run `pnpm install` first.");
  process.exit(1);
}

const developmentEnv = {
  ...process.env,
  INNGEST_DEV: process.env.INNGEST_DEV ?? "1",
  PATH: `${dirname(nodeBinary)}${delimiter}${process.env.PATH ?? ""}`
};

const web = spawn(nodeBinary, [turbo, "dev"], {
  stdio: "inherit",
  env: developmentEnv
});

web.on("error", (error) => {
  console.error(`Could not start the development server: ${error.message}`);
  process.exit(1);
});

let workflows;
let worker;
let stopping = false;

function stop(signal = "SIGTERM", exitCode) {
  if (stopping) return;
  stopping = true;
  if (workflows && workflows.exitCode === null) workflows.kill(signal);
  if (worker && worker.exitCode === null) worker.kill(signal);
  if (web.exitCode === null) web.kill(signal);
  if (exitCode !== undefined) process.exitCode = exitCode;
}

process.on("SIGINT", () => stop("SIGINT", 130));
process.on("SIGTERM", () => stop("SIGTERM", 143));

web.on("exit", (code) => {
  if (!stopping) stop("SIGTERM", code ?? 1);
});

async function waitForWeb() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (web.exitCode !== null) throw new Error("The web server exited before it became ready.");
    try {
      const response = await fetch("http://127.0.0.1:3000/api/inngest", {
        signal: AbortSignal.timeout(1_000)
      });
      if (response.ok) return;
    } catch {
      // Next.js is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  throw new Error("Timed out waiting for the web server at http://127.0.0.1:3000.");
}

try {
  await waitForWeb();
  const inngest = resolve(process.cwd(), "apps/web/node_modules/.bin/inngest");
  if (!existsSync(inngest)) {
    throw new Error("Inngest is not installed. Run `pnpm install` first.");
  }
  workflows = spawn(inngest, ["dev", "-u", "http://127.0.0.1:3000/api/inngest"], {
    cwd: resolve(process.cwd(), "apps/web"),
    stdio: "inherit",
    env: developmentEnv
  });
  workflows.on("error", (error) => {
    console.error(`Could not start the workflow runner: ${error.message}`);
    stop("SIGTERM", 1);
  });
  workflows.on("exit", (code) => {
    if (!stopping) stop("SIGTERM", code ?? 1);
  });
  const workerRoot = resolve(process.cwd(), "apps/worker");
  const workerPython = resolve(workerRoot, ".venv/bin/python");
  if (!existsSync(workerPython)) {
    throw new Error("The career worker is not installed. Run `uv sync --project apps/worker` first.");
  }
  worker = spawn(workerPython, ["-m", "career_worker", "inngest"], {
    cwd: workerRoot,
    stdio: "inherit",
    env: {
      ...developmentEnv,
      PYTHONPATH: `${resolve(workerRoot, "src")}${delimiter}${process.env.PYTHONPATH ?? ""}`
    }
  });
  worker.on("error", (error) => {
    console.error(`Could not start the document worker: ${error.message}`);
    stop("SIGTERM", 1);
  });
  worker.on("exit", (code) => {
    if (!stopping) stop("SIGTERM", code ?? 1);
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : "Could not start the development stack.");
  stop("SIGTERM", 1);
}
