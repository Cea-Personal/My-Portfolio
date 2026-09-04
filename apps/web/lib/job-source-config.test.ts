import { describe, expect, it } from "vitest";
import {
  getJobSourceAdapter,
  validateLinkedInJobUrl,
  validateJobSourceEndpoint,
  validateSecretReference
} from "./job-source-config";

describe("job source configuration", () => {
  it("accepts only supported adapter versions", () => {
    expect(getJobSourceAdapter("greenhouse", "v1")?.type).toBe("greenhouse");
    expect(getJobSourceAdapter("greenhouse", "v2")).toBeNull();
    expect(getJobSourceAdapter("unknown", "v1")).toBeNull();
  });

  it("rejects unsafe or credential-bearing endpoints", () => {
    expect(validateJobSourceEndpoint("http://example.com/jobs")).toBeNull();
    expect(validateJobSourceEndpoint("https://localhost/jobs")).toBeNull();
    expect(validateJobSourceEndpoint("https://127.0.0.1/jobs")).toBeNull();
    expect(validateJobSourceEndpoint("https://user:pass@example.com/jobs")).toBeNull();
    expect(validateJobSourceEndpoint("https://jobs.example.com/feed")).toBe(
      "https://jobs.example.com/feed"
    );
  });

  it("stores only secret references with an environment-safe name", () => {
    expect(validateSecretReference("JOB_SOURCE_TOKEN")).toBe("JOB_SOURCE_TOKEN");
    expect(validateSecretReference("")).toBeNull();
    expect(validateSecretReference("actual-secret-value!")).toBeUndefined();
  });

  it("accepts owner-supplied LinkedIn listing links without treating them as scrape endpoints", () => {
    expect(validateLinkedInJobUrl("https://www.linkedin.com/jobs/view/123/?trk=feed")).toBe(
      "https://www.linkedin.com/jobs/view/123/"
    );
    expect(validateLinkedInJobUrl("https://linkedin.com/in/basil")).toBeNull();
    expect(validateLinkedInJobUrl("http://www.linkedin.com/jobs/view/123")).toBeNull();
  });
});
