import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  invalidRole: false,
  failedSpawn: false,
  requests: [] as { id: number; method: string; params: Record<string, unknown> }[],
  killed: false
}));

vi.mock("node:child_process", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    spawn: () => {
      const child = new EventEmitter();
      const stdout = new EventEmitter();
      const stderr = new EventEmitter();
      const emit = (value: unknown) => stdout.emit("data", JSON.stringify(value) + "\n");
      const stdin = {
        write: (text: string) => {
          const message = JSON.parse(text);
          if (!message.id) return;
          harness.requests.push(message);
          queueMicrotask(() => {
            if (message.method === "initialize") {
              if (harness.invalidRole)
                emit({
                  method: "configWarning",
                  params: {
                    summary:
                      "Ignoring malformed agent role definition at /.codex/agents/role-fit-analyst.toml: invalid type: sequence, expected a map"
                  }
                });
              emit({ id: message.id, result: {} });
            } else if (message.method === "thread/start") {
              emit({ id: message.id, result: { thread: { id: "parent" }, model: "gpt-test" } });
            } else if (message.method === "turn/start") {
              emit({ id: message.id, result: { turn: { id: "parent-turn" } } });
              // Other threads must never finish this request, even before its child starts.
              emit({
                method: "turn/completed",
                params: {
                  threadId: "unrelated",
                  turn: { id: "other-turn", status: "completed", items: [] }
                }
              });
              emit({
                method: "item/completed",
                params: {
                  threadId: "parent",
                  item: {
                    type: "collabAgentToolCall",
                    tool: "spawnAgent",
                    status: harness.failedSpawn ? "failed" : "completed",
                    receiverThreadIds: harness.failedSpawn ? [] : ["analyst"]
                  }
                }
              });
              emit({
                method: "item/agentMessage/delta",
                params: { threadId: "analyst", delta: "child commentary" }
              });
              emit({
                method: "turn/completed",
                params: {
                  threadId: "analyst",
                  turn: { id: "child-turn", status: "completed", items: [] }
                }
              });
              emit({
                method: "item/agentMessage/delta",
                params: { threadId: "parent", delta: "progress commentary" }
              });
              emit({
                method: "turn/completed",
                params: {
                  threadId: "parent",
                  turn: {
                    id: "parent-turn",
                    status: "completed",
                    items: [
                      { type: "agentMessage", text: '{"summary":"Final comparison","matches":[]}' }
                    ]
                  }
                }
              });
            } else {
              emit({ id: message.id, result: {} });
            }
          });
        }
      };
      return Object.assign(child, {
        stdout,
        stderr,
        stdin,
        kill: () => {
          harness.killed = true;
        }
      });
    }
  };
});

import { runCodexOrchestrator } from "./codex-app-server";

describe("native orchestration transport", () => {
  beforeEach(() => {
    harness.invalidRole = false;
    harness.failedSpawn = false;
    harness.requests = [];
    harness.killed = false;
  });

  it("uses a stored parent and accepts only its final answer after child execution", async () => {
    const result = await runCodexOrchestrator("role_fit", {});
    expect(
      harness.requests.find((request) => request.method === "thread/start")?.params.ephemeral
    ).toBe(false);
    expect(result.text).toBe('{"summary":"Final comparison","matches":[]}');
    expect(result.subagentThreadId).toBe("analyst");
    expect(harness.killed).toBe(true);
  });

  it("fails before model execution when Codex reports a malformed selected agent", async () => {
    harness.invalidRole = true;
    await expect(runCodexOrchestrator("role_fit", {})).rejects.toThrow(
      "invalid native agent configuration:role-fit-analyst"
    );
    expect(harness.requests.some((request) => request.method === "turn/start")).toBe(false);
    expect(harness.killed).toBe(true);
  });

  it("does not accept a failed spawn as evidence that the analyst executed", async () => {
    harness.failedSpawn = true;
    await expect(runCodexOrchestrator("role_fit", {})).rejects.toThrow(
      "native child agent did not start"
    );
  });
});
