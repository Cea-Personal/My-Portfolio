import { expect, it } from "vitest";
import { toPublicSections } from "./public-view";

it("orders impact and project sections deterministically", () => {
  const result = toPublicSections({
    status: "published",
    items: [
      {
        publicId: "a",
        sourceEntityType: "project",
        sourceEntityId: "a",
        title: "A",
        publicSummary: "A",
        displayOrder: 2
      },
      {
        publicId: "b",
        sourceEntityType: "achievement",
        sourceEntityId: "b",
        title: "B",
        publicSummary: "B",
        displayOrder: 1
      }
    ]
  });
  expect(result.map((section) => section.id)).toEqual(["projects", "impact"]);
});
