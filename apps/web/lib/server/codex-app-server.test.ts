import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildOrchestratorPrompt,
  codexErrorMessage,
  codexAgentRoleForTask,
  codexOutputSchemaForTask,
  isNativeChildAgentEvent
} from "./codex-app-server";

describe("native Codex orchestration", () => {
  it("keeps private MCP servers disabled with valid transports in the public role", () => {
    const config = readFileSync(".codex/agents/portfolio-assistant.toml", "utf8");
    for (const server of ["supabase", "jobspipe", "playwright"]) {
      const section = config.split(`[mcp_servers.${server}]`)[1]?.split("\n[")[0] ?? "";
      expect(section).toMatch(/enabled\s*=\s*false/);
      expect(section).toMatch(/(?:command|url)\s*=\s*"[^"\n]+"/);
    }
  });
  it("routes nested public chat requests without sending general questions to retrieval", () => {
    const general = buildOrchestratorPrompt("public_qa", {
      system: "Instructions",
      input: { mode: "general", question: "What is SQL?" }
    });
    expect(general).toContain("general conversational request");
    expect(general).not.toContain("use the native get_public_portfolio_context");
    const grounded = buildOrchestratorPrompt("public_qa", { input: { mode: "retrieved_context" } });
    expect(grounded).toContain("Retrieval is complete");
    expect(grounded).toContain("connecting relevant facts rather than copying CV text");
  });

  it("requires a score per role requirement and instructs coverage of unsupported areas", () => {
    expect(codexOutputSchemaForTask("role_fit").properties?.matches?.items?.required).toContain(
      "score"
    );
    expect(buildOrchestratorPrompt("role_fit", {})).toContain(
      "including partial and unsupported areas"
    );
  });
  it("maps application tasks to native custom agent names", () => {
    expect(codexAgentRoleForTask("document_composition")).toBe("application-writer");
    expect(codexAgentRoleForTask("role_fit")).toBe("role-fit-analyst");
    expect(codexAgentRoleForTask("image_generation")).toBe("image-generator");
    expect(codexAgentRoleForTask("career_project_synthesis")).toBe("career-synthesizer");
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
      "career_profile_synthesis",
      "career_experience_synthesis",
      "career_project_synthesis",
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

  it("uses focused Career Brain contracts for parallel native synthesis", () => {
    expect(
      Object.keys(codexOutputSchemaForTask("career_profile_synthesis").properties ?? {})
    ).toEqual([
      "cvSummary",
      "portfolioSummary",
      "about",
      "education",
      "certifications",
      "technicalSkills"
    ]);
    expect(
      Object.keys(codexOutputSchemaForTask("career_experience_synthesis").properties ?? {})
    ).toEqual(["experiences"]);
    expect(
      Object.keys(codexOutputSchemaForTask("career_project_synthesis").properties ?? {})
    ).toEqual(["projects"]);
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
