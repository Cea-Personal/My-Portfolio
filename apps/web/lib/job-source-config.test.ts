import { describe, expect, it } from "vitest";
import {
  getJobSourceAdapter,
  defaultJobSourceEndpoint,
  normalizeJobSourceType,
  normalizeJobSourceEndpoint,
  resolveJobSourceEndpoint,
  supportedJobSourceTypes,
  validateLinkedInJobUrl,
  validateJobSourceEndpoint,
  validateSecretReference
} from "./job-source-config";

describe("job source configuration", () => {
  it("accepts only supported adapter versions", () => {
    expect(getJobSourceAdapter("jobgether", "v1")?.type).toBe("jobgether");
    expect(getJobSourceAdapter("jobgether", "v2")).toBeNull();
    const removedTypes = [
      "greenhouse",
      "lever",
      "ashby",
      "recruitee",
      "smartrecruiters",
      "teamtailor",
      "personio",
      "linkedin-authorized",
      "structured",
      "structured-data",
      "rss",
      "custom-rest",
      "workable"
    ];
    for (const type of removedTypes) {
      expect(getJobSourceAdapter(type, "v1")).toBeNull();
      expect(supportedJobSourceTypes).not.toContain(type);
    }
    expect(getJobSourceAdapter("unknown", "v1")).toBeNull();
    expect(getJobSourceAdapter("arbeitnow", "v1")?.type).toBe("arbeitnow");
    expect(normalizeJobSourceType("arbietnow")).toBe("arbeitnow");
    expect(getJobSourceAdapter("arbietnow", "v1")?.type).toBe("arbeitnow");
    expect(getJobSourceAdapter("jobspipe", "v1")?.type).toBe("jobspipe");
    expect(defaultJobSourceEndpoint("adzuna")).toContain("api.adzuna.com");
    expect(defaultJobSourceEndpoint("remoteok")).toBe(
      "https://remoteok-jobs-api.p.rapidapi.com/jobs"
    );
    expect(defaultJobSourceEndpoint("jsearch")).toBe("https://jsearch.p.rapidapi.com/search");
    expect(defaultJobSourceEndpoint("jobspipe")).toBe("https://mcp.jobspipe.dev/mcp");
    expect(normalizeJobSourceEndpoint("https://api.jobspipe.dev/v1/jobs/search", "jobspipe")).toBe(
      "https://mcp.jobspipe.dev/mcp"
    );
    expect(
      normalizeJobSourceEndpoint("https://www.openwebninja.com/api/jsearch/docs", "jsearch")
    ).toBe("https://api.openwebninja.com/jsearch/search-v2");
    expect(resolveJobSourceEndpoint("", "arbeitnow")).toBe(
      "https://www.arbeitnow.com/api/job-board-api"
    );
    expect(
      normalizeJobSourceEndpoint("http://api.adzuna.com:80/v1/api/jobs/gb/search/1", "adzuna")
    ).toBe("https://api.adzuna.com/v1/api/jobs/gb/search/1");
    expect(normalizeJobSourceEndpoint("http://example.com/jobs", "adzuna")).toBeNull();
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
