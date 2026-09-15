import { describe, expect, it } from "vitest";
import { answerPublicQuestion } from "./public-chat";

describe("public chat retrieval", () => {
  it("uses semantic hits when the visitor wording has no lexical overlap", () => {
    const result = answerPublicQuestion("What have you worked on?", [
      {
        handle: "evidence-1",
        text: "Designed a reliable Airflow ingestion platform for production reporting.",
        semantic: true
      }
    ]);

    expect(result.abstained).toBe(false);
    expect(result.answer).toContain("Designed a reliable Airflow ingestion platform");
    expect(result.answer).not.toContain("•");
    expect(result.citations).toEqual(["evidence-1"]);
  });

  it("does not use an unrelated semantic hit for non-career identity questions", () => {
    const result = answerPublicQuestion("What is my name?", [
      {
        handle: "project-1",
        text: "A market research and trading decision-support platform.",
        semantic: true
      }
    ]);

    expect(result.abstained).toBe(true);
    expect(result.citations).toEqual([]);
  });
});
