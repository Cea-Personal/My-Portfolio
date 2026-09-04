import { expect, it } from "vitest";
import { createPublicEvent } from "@career-os/analytics";

it("rejects private text-like and non-allowlisted properties", () => {
  expect(() => createPublicEvent("page_view", { query: "private" })).toThrow(
    "EVENT_PROPERTY_NOT_ALLOWED"
  );
  expect(createPublicEvent("section_view", { section: "about" }).properties).toEqual({
    section: "about"
  });
});
