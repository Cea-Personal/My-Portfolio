import { expect, it } from "vitest";
import { createManualJob } from "@career-os/jobs";

it("requires a JD for manual jobs", () => {
  expect(() => createManualJob({ company: "Cea", title: "Engineer", description: "" })).toThrow(
    "JOB_DESCRIPTION_REQUIRED"
  );
});
