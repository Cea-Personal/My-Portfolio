import { expect, it } from "vitest";
import { createPublicEvent } from "@career-os/analytics";

it("strips private text-like properties from public events", () => {
  const event = createPublicEvent("page_view", { section: "hero", query: "private" });
  expect(event.properties).toEqual({ section: "hero" });
});
