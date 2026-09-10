import { describe, expect, it } from "vitest";
import {
  buildOrchestratorPrompt,
  codexErrorMessage,
  codexAgentRoleForTask,
  codexOutputSchemaForTask,
  isNativeChildAgentEvent
} from "./codex-app-server";

describe("native Codex orchestration", () => {
  it("maps application tasks to native custom agent names", () => {
    expect(codexAgentRoleForTask("document_composition")).toBe("application-writer");
    expect(codexAgentRoleForTask("role_fit")).toBe("role-fit-analyst");
    expect(codexAgentRoleForTask("image_generation")).toBe("image-generator");
  });

  it("rejects tasks without a native role", () => {
    expect(() => codexAgentRoleForTask("unknown_task")).toThrow(
      "CODEX_NATIVE_AGENT_ROLE_UNKNOWN:unknown_task"
    );
  });

  it("instructs one parent thread to delegate through native spawn_agent", () => {
    const prompt = buildOrchestratorPrompt("writing_assistance", { text: "hello" });
    expect(prompt).toContain("spawn_agent");
    expect(prompt).toContain("writing-editor");
    expect(prompt).toContain("Never mention Thames Water");
    expect(prompt).toContain('"text":"hello"');
  });

  it("recognizes the native child-agent event shape", () => {
    expect(isNativeChildAgentEvent({ type: "collabAgentToolCall", tool: "spawnAgent" })).toBe(true);
    expect(isNativeChildAgentEvent({ type: "subAgentActivity", kind: "started" })).toBe(true);
    expect(isNativeChildAgentEvent({ type: "agentMessage", text: "answer" })).toBe(false);
  });

  it("uses a closed, task-specific output schema for native turns", () => {
    for (const task of [
      "public_qa",
      "role_fit",
      "evidence_extraction",
      "career_gap",
      "job_scoring",
      "document_composition",
      "application_answers",
      "compensation",
      "interview_preparation",
      "writing_assistance",
      "image_generation"
    ]) {
      const schema = codexOutputSchemaForTask(task);
      expect(schema.type).toBe("object");
      expect(schema.additionalProperties).toBe(false);
      expect(Object.keys(schema.properties ?? {}).length).toBeGreaterThan(0);
      expect(schema.required).toEqual(Object.keys(schema.properties ?? {}));
    }
  });

  it("requires interview questions to include grounded suggested answers", () => {
    const schema = codexOutputSchemaForTask("interview_preparation");
    const questions = schema.properties?.questions;
    expect(questions?.type).toBe("array");
    expect(questions?.items?.required).toContain("answer");
    expect(questions?.items?.required).toContain("evidenceId");
  });

  it("keeps application documents and employer answers on separate contracts", () => {
    expect(Object.keys(codexOutputSchemaForTask("document_composition").properties ?? {})).toEqual([
      "documents"
    ]);
    expect(Object.keys(codexOutputSchemaForTask("application_answers").properties ?? {})).toEqual([
      "answers"
    ]);
  });

  it("reads nested app-server error messages", () => {
    expect(codexErrorMessage({ error: { message: "invalid output schema" } })).toBe(
      "invalid output schema"
    );
    expect(codexErrorMessage({ message: "fallback" })).toBe("fallback");
  });
});
