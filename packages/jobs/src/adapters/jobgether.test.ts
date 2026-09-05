import { describe, expect, it } from "vitest";
import { jobgetherAdapter } from "./jobgether";

describe("Jobgether adapter", () => {
  it("maps the public API response and translates profile query fields", async () => {
    let requested = "";
    const records = await jobgetherAdapter.collect({
      endpoint: "https://jobgether.com/api/v1/jobs",
      query: { title: "Data Engineer", location: "worldwide" },
      fetcher: async (input) => {
        requested = String(input);
        return new Response(
          JSON.stringify({
            jobs: [
              {
                id: "job-1",
                title: "Senior Data Engineer",
                company: "Example",
                location: "Worldwide",
                url: "https://www.jobgether.com/offer/example",
                description: "Build reliable data platforms"
              }
            ]
          }),
          { headers: { "content-type": "application/json" } }
        );
      }
    });
    expect(requested).toContain("keyword=Data+Engineer");
    expect(requested).toContain("locations=worldwide");
    expect(records).toEqual([
      expect.objectContaining({
        externalId: "job-1",
        title: "Senior Data Engineer",
        canonicalUrl: "https://www.jobgether.com/offer/example"
      })
    ]);
  });

  it("maps supported search-profile criteria to documented Jobgether parameters", async () => {
    let requested = "";
    await jobgetherAdapter.collect({
      endpoint: "https://jobgether.com/astroapi/ai/jobs.json",
      query: {
        title: "Data Engineer",
        preferredTitle: "Analytics Engineer",
        technology: "Python,SQL",
        preferredTechnology: "dbt",
        preferredCompany: "Example",
        location: "Nigeria,Remote",
        industry: "fintech",
        seniority: "senior",
        workArrangement: "remote",
        employmentType: "full-time",
        minimumSalary: "60000",
        salaryCurrency: "USD",
        language: "English"
      },
      fetcher: async (input) => {
        requested = String(input);
        return new Response(
          JSON.stringify({
            jobs: [
              {
                id: "job-filtered",
                title: "Data Engineer",
                company: "Example",
                url: "https://jobgether.com/offer/job-filtered"
              }
            ]
          }),
          { headers: { "content-type": "application/json" } }
        );
      }
    });
    expect(requested).toContain("keyword=Data+Engineer+Analytics+Engineer+Python%2CSQL+dbt+Example+English");
    expect(requested).toContain("locations=nigeria");
    expect(requested).toContain("industries=fintech");
    expect(requested).toContain("contractType=full-time");
    expect(requested).toContain("experience=senior-5-10-years");
    expect(requested).toContain("remoteType=full-remote");
    expect(requested).toContain("salaryMin=60000");
    expect(requested).toContain("currency=USD");
  });

  it("normalizes the www host to the documented API host", async () => {
    let requested = "";
    await jobgetherAdapter.collect({
      endpoint: "https://www.jobgether.com/api/v1/jobs",
      fetcher: async (input) => {
        requested = String(input);
        return new Response(JSON.stringify({ jobs: [] }), {
          headers: { "content-type": "application/json" }
        });
      }
    });
    expect(requested).toContain("https://jobgether.com/astroapi/ai/jobs.json");
    expect(requested).not.toContain("https://www.jobgether.com/api/v1/jobs");
  });

  it("recovers from the docs or deprecated endpoint being pasted into settings", async () => {
    let requested = "";
    await jobgetherAdapter.collect({
      endpoint: "https://jobgether.com/developers",
      fetcher: async (input) => {
        requested = String(input);
        return new Response(JSON.stringify({ jobs: [] }), {
          headers: { "content-type": "application/json" }
        });
      }
    });
    expect(requested).toContain("https://jobgether.com/astroapi/ai/jobs.json");
  });

  it("falls back to provider-side keyword search when a location slug is rejected", async () => {
    const requests: string[] = [];
    const records = await jobgetherAdapter.collect({
      endpoint: "https://jobgether.com/astroapi/ai/jobs.json",
      query: { title: "Data Engineer", location: "Kigali" },
      fetcher: async (input) => {
        requests.push(String(input));
        if (requests.length === 1) return new Response("invalid location", { status: 400 });
        return new Response(
          JSON.stringify({
            jobs: [
              {
                id: "job-2",
                title: "Data Engineer",
                company: "Example",
                url: "https://www.jobgether.com/offer/example-2"
              }
            ]
          }),
          { headers: { "content-type": "application/json" } }
        );
      }
    });
    expect(requests).toHaveLength(2);
    expect(requests[0]).toContain("locations=kigali");
    expect(requests[1]).not.toContain("locations=");
    expect(records).toHaveLength(1);
  });

  it("falls back to a broad page when valid filters produce no jobs", async () => {
    const requests: string[] = [];
    const records = await jobgetherAdapter.collect({
      endpoint: "https://jobgether.com/astroapi/ai/jobs.json",
      query: { title: "Data Engineer", location: "Remote" },
      fetcher: async (input) => {
        requests.push(String(input));
        return new Response(
          JSON.stringify(
            requests.length === 1
              ? { jobs: [] }
              : {
                  jobs: [
                    {
                      id: "job-3",
                      title: "Data Engineer",
                      company: "Example",
                      url: "https://jobgether.com/offer/example-3"
                    }
                  ]
                }
          ),
          { headers: { "content-type": "application/json" } }
        );
      }
    });
    expect(requests).toHaveLength(2);
    expect(requests[0]).toContain("keyword=Data+Engineer");
    expect(requests[0]).not.toContain("locations=");
    expect(requests[1]).not.toContain("keyword=");
    expect(records).toHaveLength(1);
  });
});
