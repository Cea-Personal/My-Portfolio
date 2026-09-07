import { existsSync } from "node:fs";
import path from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";

type JsonRpcResponse = {
  id?: number;
  result?: unknown;
  error?: { code?: number; message?: string };
};

type JsonRpcNotification = {
  method?: string;
  params?: Record<string, unknown>;
};

export type CodexTurnResult = {
  text: string;
  model: string;
  threadId: string;
  turnId?: string;
  nativeAgentRole: string;
  subagentThreadId?: string;
};

const TASK_TO_NATIVE_ROLE = {
  public_qa: "portfolio_assistant",
  role_fit: "role_fit_analyst",
  evidence_extraction: "career_synthesizer",
  career_gap: "career_gap_analyst",
  job_scoring: "job_matcher",
  document_composition: "application_writer",
  compensation: "compensation_analyst",
  interview_preparation: "interview_coach",
  writing_assistance: "writing_editor"
} as const;

export function codexAgentRoleForTask(task: string): string {
  if (!Object.prototype.hasOwnProperty.call(TASK_TO_NATIVE_ROLE, task)) {
    throw new Error(`CODEX_NATIVE_AGENT_ROLE_UNKNOWN:${task}`);
  }
  return TASK_TO_NATIVE_ROLE[task as keyof typeof TASK_TO_NATIVE_ROLE];
}

function appServerArgs(): string[] {
  const configured = process.env.CODEX_APP_SERVER_ARGS?.trim();
  if (!configured) return ["app-server", "--stdio"];
  try {
    const parsed: unknown = JSON.parse(configured);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    // Keep a readable fallback for simple local configurations.
  }
  return configured.split(/\s+/).filter(Boolean);
}

function projectRoot(): string {
  const configured = process.env.CODEX_PROJECT_ROOT?.trim();
  if (configured) return path.resolve(configured);
  let current = path.resolve(process.cwd());
  let parent = path.dirname(current);
  while (current !== parent) {
    if (
      existsSync(path.join(current, ".codex", "config.toml")) ||
      existsSync(path.join(current, "pnpm-workspace.yaml"))
    ) {
      return current;
    }
    current = parent;
    parent = path.dirname(current);
  }
  return existsSync(path.join(current, ".codex", "config.toml")) ? current : process.cwd();
}

function modelFor(): string | null {
  const configured = process.env.CODEX_APP_SERVER_MODEL?.trim();
  return configured && configured !== "server-default" ? configured : "gpt-5.6-sol";
}

function readTextFromCompletedTurn(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const turn = (value as Record<string, unknown>).turn;
  if (!turn || typeof turn !== "object") return "";
  const items = (turn as Record<string, unknown>).items;
  if (!Array.isArray(items)) return "";
  const itemList = items as unknown[];
  for (let index = itemList.length - 1; index >= 0; index -= 1) {
    const item = itemList[index];
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (row.type === "agentMessage" && typeof row.text === "string") return row.text;
  }
  return "";
}

function requestError(message: string): Error {
  return new Error(`CODEX_APP_SERVER_REQUEST_FAILED:${message}`);
}

export function buildOrchestratorPrompt(
  task: string,
  input: Record<string, unknown>,
  nativeRole = codexAgentRoleForTask(task)
): string {
  return [
    "You are the Career OS orchestrator.",
    `Delegate this request to exactly one native Codex custom agent named ${nativeRole} using the native spawn_agent tool.`,
    "Do not answer the request yourself. Wait for the child agent to finish, then return the child's JSON object unchanged.",
    "Use only the supplied evidence and follow the child agent's privacy and grounding instructions.",
    "The caller requires a JSON object and will reject prose outside JSON.",
    JSON.stringify({ task, nativeRole, request: input })
  ].join("\n");
}

export function isNativeChildAgentEvent(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  if (item.type === "collabAgentToolCall" && item.tool === "spawnAgent") return true;
  if (item.type === "subAgentActivity" && item.kind === "started") return true;
  return item.item ? isNativeChildAgentEvent(item.item) : false;
}

function inspectItem(
  value: unknown,
  state: { started: boolean; subagentThreadId: string | undefined }
): void {
  if (!value || typeof value !== "object") return;
  const item = value as Record<string, unknown>;
  if (item.type === "collabAgentToolCall" && item.tool === "spawnAgent") {
    state.started = true;
    const ids = item.receiverThreadIds;
    if (Array.isArray(ids) && typeof ids[0] === "string") state.subagentThreadId = ids[0];
  }
  if (item.type === "subAgentActivity" && item.kind === "started") {
    state.started = true;
    if (typeof item.agentThreadId === "string") state.subagentThreadId = item.agentThreadId;
  }
  if (item.item) inspectItem(item.item, state);
}

const ORCHESTRATOR_DEVELOPER_INSTRUCTIONS = [
  "You are the single Career OS orchestrator thread.",
  "For every request, use the native Codex spawn_agent collaboration tool exactly once.",
  "Select the named native custom agent from the project's .codex/agents directory.",
  "Wait for the child to finish and return its JSON result without adding claims or private data.",
  "Do not request approvals or access the filesystem for this web request."
].join(" ");

async function runTurn(
  child: ChildProcessWithoutNullStreams,
  task: string,
  input: Record<string, unknown>,
  timeoutMs: number
): Promise<CodexTurnResult> {
  const nativeAgentRole = codexAgentRoleForTask(task);
  const root = projectRoot();
  let buffer = "";
  let nextId = 1;
  let threadId = "";
  let model = modelFor() ?? "server-default";
  let turnId: string | undefined;
  let streamedText = "";
  const childState = { started: false, subagentThreadId: undefined as string | undefined };
  const pending = new Map<number, (message: JsonRpcResponse) => void>();
  const rejected = new Map<number, (error: Error) => void>();
  let completedResolve: ((value: CodexTurnResult) => void) | undefined;
  let completedReject: ((error: Error) => void) | undefined;
  const completed = new Promise<CodexTurnResult>((resolve, reject) => {
    completedResolve = resolve;
    completedReject = reject;
  });
  const send = (message: Record<string, unknown>) => {
    child.stdin.write(`${JSON.stringify(message)}\n`);
  };
  const request = (method: string, params: Record<string, unknown>) => {
    const id = nextId++;
    send({ jsonrpc: "2.0", id, method, params });
    return new Promise<JsonRpcResponse>((resolve, reject) => {
      pending.set(id, resolve);
      rejected.set(id, reject);
    });
  };
  const onLine = (line: string) => {
    if (!line.trim()) return;
    let message: JsonRpcResponse & JsonRpcNotification;
    try {
      message = JSON.parse(line) as JsonRpcResponse & JsonRpcNotification;
    } catch {
      return;
    }
    if (typeof message.id === "number" && message.method) {
      send({
        jsonrpc: "2.0",
        id: message.id,
        error: { code: -32000, message: "Interactive approvals are disabled for web subagents." }
      });
      return;
    }
    if (typeof message.id === "number") {
      const resolve = pending.get(message.id);
      const reject = rejected.get(message.id);
      pending.delete(message.id);
      rejected.delete(message.id);
      if (message.error) reject?.(requestError(message.error.message ?? "unknown"));
      else resolve?.(message);
      return;
    }
    if (message.method === "item/started" || message.method === "item/completed") {
      inspectItem(message.params?.item, childState);
      return;
    }
    if (message.method === "item/subAgentActivity") {
      inspectItem(message.params, childState);
      return;
    }
    if (message.method === "item/agentMessage/delta") {
      const delta = message.params?.delta;
      if (typeof delta === "string") streamedText += delta;
      return;
    }
    if (message.method === "turn/completed") {
      const params = message.params ?? {};
      const turn = params.turn;
      if (turn && typeof turn === "object") {
        const turnRecord = turn as Record<string, unknown>;
        turnId = typeof turnRecord.id === "string" ? turnRecord.id : turnId;
        const items = turnRecord.items;
        if (Array.isArray(items)) for (const item of items) inspectItem(item, childState);
        const status = turnRecord.status;
        const failed =
          status === "failed" ||
          status === "interrupted" ||
          (status &&
            typeof status === "object" &&
            (status as Record<string, unknown>).type === "failed");
        if (failed) {
          const error = turnRecord.error;
          const detail =
            error &&
            typeof error === "object" &&
            typeof (error as Record<string, unknown>).message === "string"
              ? (error as Record<string, unknown>).message
              : "turn failed";
          completedReject?.(requestError(String(detail)));
          return;
        }
      }
      if (!childState.started) {
        completedReject?.(requestError(`native child agent did not start:${nativeAgentRole}`));
        return;
      }
      const text = streamedText || readTextFromCompletedTurn(params);
      if (!text.trim()) {
        completedReject?.(requestError("turn returned no assistant message"));
        return;
      }
      completedResolve?.({
        text,
        model,
        threadId,
        nativeAgentRole,
        ...(turnId ? { turnId } : {}),
        ...(childState.subagentThreadId ? { subagentThreadId: childState.subagentThreadId } : {})
      });
      return;
    }
    if (message.method === "error") {
      const detail = message.params?.message;
      completedReject?.(requestError(typeof detail === "string" ? detail : "server error"));
    }
  };
  child.stdout.on("data", (chunk: Buffer | string) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) onLine(line);
  });
  child.stderr.on("data", () => {
    // Keep the stderr pipe drained; Codex emits startup diagnostics there.
  });
  child.once("error", (error) => completedReject?.(error));
  child.once("exit", (code, signal) => {
    if (!streamedText)
      completedReject?.(requestError(`process exited (${String(code ?? signal)})`));
  });
  const timer = setTimeout(() => completedReject?.(requestError("timeout")), timeoutMs);
  try {
    await request("initialize", {
      clientInfo: { name: "ai-career-os", version: "0.1.0" },
      capabilities: { experimentalApi: true }
    });
    const threadResponse = await request("thread/start", {
      ...(modelFor() ? { model: modelFor() } : {}),
      ephemeral: true,
      approvalPolicy: "never",
      sandbox: "read-only",
      cwd: root,
      developerInstructions: ORCHESTRATOR_DEVELOPER_INSTRUCTIONS,
      threadSource: "cli"
    });
    const threadResult = threadResponse.result as Record<string, unknown> | undefined;
    const thread = threadResult?.thread as Record<string, unknown> | undefined;
    if (!thread || typeof thread.id !== "string") throw requestError("thread/start returned no id");
    threadId = thread.id;
    if (typeof threadResult?.model === "string") model = threadResult.model;
    await request("turn/start", {
      threadId,
      input: [{ type: "text", text: buildOrchestratorPrompt(task, input, nativeAgentRole) }],
      effort: "high",
      approvalPolicy: "never",
      outputSchema: { type: "object", additionalProperties: true }
    });
    return await completed;
  } finally {
    clearTimeout(timer);
  }
}

export async function runCodexOrchestrator(
  task: string,
  input: Record<string, unknown>,
  options: { timeoutMs?: number } = {}
): Promise<CodexTurnResult> {
  codexAgentRoleForTask(task);
  const command = process.env.CODEX_APP_SERVER_COMMAND?.trim() || "codex";
  const root = projectRoot();
  const child = spawn(command, appServerArgs(), {
    cwd: root,
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"]
  });
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 120_000, 5_000), 300_000);
  try {
    return await runTurn(child, task, input, timeoutMs);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "ENOENT"
    ) {
      throw new Error(`CODEX_APP_SERVER_COMMAND_NOT_FOUND:${command}`);
    }
    throw error;
  } finally {
    child.kill();
  }
}

export function codexSubagentRequestId(): string {
  return randomUUID();
}
