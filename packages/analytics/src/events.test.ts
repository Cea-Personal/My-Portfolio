import { describe, expect, it } from "vitest";
import { createPublicEvent } from "./events";
describe("public analytics allowlist", () => {
  it("accepts a known public section", () => {
    expect(createPublicEvent("section_view", { section: "experience" }).properties).toEqual({
      section: "experience"
    });
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
