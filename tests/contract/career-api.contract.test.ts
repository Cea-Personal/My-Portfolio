import { expect, it } from "vitest";
import { previewProjection, publishProjection } from "@career-os/career";

it("publishes only an explicitly staged, allowlisted projection", () => {
  const staged = previewProjection("00000000-0000-4000-8000-000000000001", 1, [], []);
  expect(staged.status).toBe("staged");
  expect(publishProjection(staged, true).status).toBe("published");
});
