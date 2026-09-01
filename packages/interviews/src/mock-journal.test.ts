import { expect, it } from "vitest";
import { addInsight, createJournalEntry } from "./journal";
it("does not mutate original journal bytes when deriving insights", () => {
  const entry = createJournalEntry("owner", "Original note");
  const changed = addInsight(entry, "Derived gap");
  expect(changed.versions[0]?.contentHash).toBe(entry.versions[0]?.contentHash);
  expect(changed.insights[0]?.sourceVersionHash).toBe(entry.versions[0]?.contentHash);
});
