import { describe, expect, it } from "vitest";
import { createPublicEvent } from "./events";
describe("public analytics allowlist", () => {
  it("accepts a known public section", () => {
    expect(createPublicEvent("section_view", { section: "experience" }).properties).toEqual({
      section: "experience"
    });
  });
  it("accepts bounded engagement and categorized acquisition metadata", () => {
    expect(createPublicEvent("page_view", { page: "home", source: "linkedin" }).properties).toEqual(
      { page: "home", source: "linkedin" }
    );
    expect(
      createPublicEvent("section_engagement", {
        section: "projects",
        duration_seconds: 42
      }).properties
    ).toEqual({ section: "projects", duration_seconds: 42 });
    expect(() =>
      createPublicEvent("page_engagement", { page: "home", duration_seconds: 1801 })
    ).toThrow("EVENT_PROPERTY_NOT_ALLOWED");
  });
  it("rejects URLs, queries, prompts, and arbitrary free text even under benign keys", () => {
    expect(() => createPublicEvent("page_view", { url: "https://private.test?a=secret" })).toThrow(
      "EVENT_PROPERTY_NOT_ALLOWED"
    );
    expect(() =>
      createPublicEvent("article_view", { article: "my private unbounded prose with spaces" })
    ).toThrow("EVENT_PROPERTY_NOT_ALLOWED");
    expect(() => createPublicEvent("ai_conversation_started", { prompt: "secret" })).toThrow(
      "EVENT_PROPERTY_NOT_ALLOWED"
    );
  });
});
