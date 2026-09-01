import { expect, it } from "vitest";
import { drainDriveChanges, unchangedContent } from "@career-os/documents";

it("drains paged Drive changes and advances only after the final page", async () => {
  const pages = [
    {
      changes: [{ fileId: "a", name: "A", mimeType: "text/plain", version: "1" }],
      nextPageToken: "next"
    },
    {
      changes: [{ fileId: "b", name: "B", mimeType: "text/plain", version: "2" }],
      newStartPageToken: "new"
    }
  ];
  const result = await drainDriveChanges(
    { listChanges: async () => pages.shift()!, exportFile: async () => new Uint8Array() },
    "start"
  );
  expect(result.nextToken).toBe("new");
  expect(result.changes).toHaveLength(2);
  expect(
    unchangedContent(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
      new TextEncoder().encode("hello")
    )
  ).toBe(true);
});
