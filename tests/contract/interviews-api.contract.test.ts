import { expect, it } from "vitest";
import { inferInterviewProcess } from "@career-os/interviews";
it("returns an explicit unknown process when no evidence exists", () => {
  expect(inferInterviewProcess([]).confidence).toBe("low");
});
