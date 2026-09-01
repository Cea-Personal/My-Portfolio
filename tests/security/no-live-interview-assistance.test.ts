import { expect, it } from "vitest";
import { assertAutomationActionAllowed } from "@career-os/auth";

it("does not expose live employer-interview assistance", () => {
  for (const action of ["join_meeting", "live_transcription", "live_answer"]) {
    expect(() => assertAutomationActionAllowed(action)).toThrow("CONSEQUENTIAL_AUTOMATION_DENIED");
  }
});
