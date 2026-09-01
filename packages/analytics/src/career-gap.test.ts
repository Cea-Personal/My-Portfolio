import { expect, it } from "vitest";
import { careerEvidenceGap } from "./career-gap";
it("distinguishes undocumented evidence from absent skill", () => {
  expect(careerEvidenceGap(["Rust"], [])[0]?.status).toBe("undocumented");
});
