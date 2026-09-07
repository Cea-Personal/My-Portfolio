import { describe, expect, it } from "vitest";
import {
  buildOrchestratorPrompt,
  codexAgentRoleForTask,
  isNativeChildAgentEvent
} from "./codex-app-server";

describe("native Codex orchestration", () => {
  it("maps application tasks to native custom agent names", () => {
    expect(codexAgentRoleForTask("document_composition")).toBe("application_writer");
    expect(codexAgentRoleForTask("role_fit")).toBe("role_fit_analyst");
  });

  it("rejects tasks without a native role", () => {
    expect(() => codexAgentRoleForTask("unknown_task")).toThrow(
      "CODEX_NATIVE_AGENT_ROLE_UNKNOWN:unknown_task"
    );
  });

  it("instructs one parent thread to delegate through native spawn_agent", () => {
    const prompt = buildOrchestratorPrompt("writing_assistance", { text: "hello" });
    expect(prompt).toContain("spawn_agent");
    expect(prompt).toContain("writing_editor");
    expect(prompt).toContain('"text":"hello"');
  });

  it("recognizes the native child-agent event shape", () => {
    expect(isNativeChildAgentEvent({ type: "collabAgentToolCall", tool: "spawnAgent" })).toBe(true);
    expect(isNativeChildAgentEvent({ type: "subAgentActivity", kind: "started" })).toBe(true);
    expect(isNativeChildAgentEvent({ type: "agentMessage", text: "answer" })).toBe(false);
  });
});
