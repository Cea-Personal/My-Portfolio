import { expect, it } from "vitest";
import { toPublicSections } from "@career-os/career";
it("keeps an explicit empty publication distinct from outage fallback", () => {
  expect(toPublicSections({ status: "published", items: [] })).toEqual([]);
});
