import { expect, it } from "vitest";
import { toPublicSections } from "@career-os/career";
it("renders an empty public projection when private services are unavailable", () => {
  expect(toPublicSections({ status: "published", items: [] })).toEqual([]);
});
