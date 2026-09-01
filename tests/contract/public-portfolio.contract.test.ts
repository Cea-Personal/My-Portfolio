import { expect, it } from "vitest";
import { toPublicSections } from "@career-os/career";

it("exposes only allowlisted public item fields", () => {
  const sections = toPublicSections({
    status: "published",
    items: [
      {
        publicId: "1",
        sourceEntityType: "project",
        sourceEntityId: "x",
        title: "Project",
        publicSummary: "Outcome",
        displayOrder: 0
      }
    ]
  });
  expect(sections[0]?.items[0]).not.toHaveProperty("privateDescription");
});
