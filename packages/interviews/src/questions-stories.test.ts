import { expect, it } from "vitest";
import { predictQuestions } from "./questions";
import { rankStories } from "./star-stories";

it("labels generated questions and ranks evidence-backed STAR stories", () => {
  expect(predictQuestions(["platform"])[0]?.confidence).toBe("medium");
  const ranked = rankStories("platform", [
    { id: "s", title: "Platform", situation: "", task: "", action: "", result: "", evidenceIds: [] }
  ]);
  expect(ranked[0]?.id).toBe("s");
});
