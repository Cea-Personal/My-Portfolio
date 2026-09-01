import { expect, it } from "vitest";
import { deduplicationKey, shouldMerge } from "./deduplication";
import { normalizeJob } from "./normalization";

it("prefers canonical source URLs and merges exact jobs", () => {
  const a = normalizeJob({
    company: "Cea",
    title: "Engineer",
    canonicalUrl: "https://jobs.test/1"
  });
  const b = normalizeJob({
    company: "Cea",
    title: "Engineer",
    canonicalUrl: "https://jobs.test/1"
  });
  expect(deduplicationKey(a)).toBe("url:https://jobs.test/1");
  expect(shouldMerge(a, b)).toBe(true);
});
