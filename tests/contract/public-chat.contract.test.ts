import { expect, it } from "vitest";
import { answerPublicQuestion } from "@career-os/ai";
it("abstains when no public evidence is available", () => {
  expect(answerPublicQuestion("What did I do?", []).abstained).toBe(true);
});
