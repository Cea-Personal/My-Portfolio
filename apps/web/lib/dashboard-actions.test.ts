import { describe, expect, it } from "vitest";
import { buildDashboardActions, type DashboardSources } from "./dashboard-actions";

const now = Date.parse("2026-10-08T09:00:00Z");
const empty = (): DashboardSources => ({
  jobs: [],
  applications: [],
  processes: [],
  opportunities: [],
  scores: [],
  proposals: [],
  facts: [],
  publications: [],
  debriefs: []
});
const items = (sources: DashboardSources, id: string) => {
  const group = buildDashboardActions(sources, now).groups.find((entry) => entry.id === id);
  if (!group) throw new Error(`Missing action group: ${id}`);
  return group.items;
};
const job = (id: string, score: number | null, extra = {}) => ({
  id,
  canonical_title: "Data Engineer",
  canonical_company: "Example",
  status: "discovered",
  job_scores:
    score === null
      ? []
      : [{ score_type: "career_match", numeric_score: score, created_at: "2026-10-07" }],
  ...extra
});

describe("Today action selection", () => {
  it("uses the latest recorded match, excluding unscored, low, applied, closed and freelance jobs", () => {
    const sources = empty();
    sources.jobs = [
      job("strong", 0.8),
      job("none", null),
      job("low", 0.5),
      job("closed", 0.9, { status: "rejected" }),
      job("applied", 0.9),
      job("freelance", 0.9, { opportunity_domain: "freelance" }),
      job("lowered", 0.9, {
        job_scores: [
          { score_type: "match", numeric_score: 0.95, created_at: "2026-10-01" },
          { score_type: "career_match", numeric_score: 0.3, created_at: "2026-10-07" }
        ]
      }),
      job("invalid", 85)
    ];
    sources.applications = [{ id: "application", job_id: "applied", status: "submitted" }];
    expect(items(sources, "jobs").map((action) => action.id)).toEqual(["strong"]);
  });

  it("uses real application statuses and a known submission date rather than inventing follow-up deadlines", () => {
    const sources = empty();
    sources.applications = [
      { id: "draft", status: "draft" },
      { id: "progress", status: "in_progress" },
      { id: "ready", status: "ready" },
      { id: "old", status: "submitted", applied_at: "2026-09-29" },
      { id: "recent", status: "submitted", applied_at: "2026-10-07" },
      { id: "unknown", status: "submitted" },
      { id: "closed", status: "closed", applied_at: "2026-09-20" },
      { id: "proposal", status: "draft", application_kind: "freelance" }
    ];
    expect(items(sources, "applications").map((action) => action.id)).toEqual([
      "draft",
      "progress",
      "ready"
    ]);
    expect(items(sources, "applications")[2]?.label).toContain("manually");
    expect(items(sources, "follow-ups").map((action) => action.id)).toEqual(["application-old"]);
  });

  it("links stages through the parent process and distinguishes preparation from overdue outcomes", () => {
    const sources = empty();
    sources.processes = [
      {
        id: "process",
        applications: { jobs: { canonical_title: "Engineer", canonical_company: "Example" } },
        interview_stages: [
          { id: "unscheduled", name: "Technical", status: "proposed" },
          {
            id: "ready",
            name: "Panel",
            status: "scheduled",
            scheduled_at: "2026-10-09T10:00:00Z",
            preparation_kits: [{ status: "ready" }]
          },
          { id: "past", name: "Screen", status: "scheduled", scheduled_at: "2026-10-07T10:00:00Z" },
          { id: "done", status: "completed" },
          { id: "cancelled", status: "cancelled" }
        ]
      }
    ];
    sources.debriefs = [
      { id: "debrief", stage_id: "done", follow_ups: ["Send the promised example"] },
      { id: "unrelated", stage_id: "missing", follow_ups: ["Not in an owned process"] }
    ];
    const interviews = items(sources, "interviews");
    expect(interviews.map((action) => action.id)).toEqual(["past", "ready", "unscheduled"]);
    expect(interviews[0]?.label).toContain("Record the outcome");
    expect(interviews[1]?.label).toContain("Review preparation");
    expect(interviews.every((action) => action.href === "/interviews/process")).toBe(true);
    expect(items(sources, "follow-ups")).toEqual([
      {
        id: "debrief-debrief",
        label: "Review recorded interview follow-ups",
        detail: "Send the promised example",
        href: "/interviews/process"
      }
    ]);
  });

  it("keeps freelance recommendations separate and prioritizes proposal review and client responses", () => {
    const sources = empty();
    sources.jobs = [job("job", null)];
    sources.opportunities = ["strong", "lowered", "draft", "response", "lost"].map((id) => ({
      id,
      job_id: "job"
    }));
    sources.scores = [
      { opportunity_id: "strong", recommendation: "APPLY", created_at: "2026-10-07" },
      { opportunity_id: "lowered", recommendation: "APPLY_NOW", created_at: "2026-10-01" },
      { opportunity_id: "lowered", recommendation: "SKIP", created_at: "2026-10-07" }
    ];
    sources.proposals = [
      {
        id: "draft",
        opportunity_id: "draft",
        approval_state: "READY_FOR_REVIEW",
        crm_status: "READY_FOR_REVIEW"
      },
      {
        id: "response",
        opportunity_id: "response",
        approval_state: "SUBMITTED",
        crm_status: "CLIENT_RESPONDED"
      },
      { id: "lost", opportunity_id: "lost", approval_state: "APPROVED", crm_status: "LOST" }
    ];
    expect(items(sources, "freelance").map((action) => action.id)).toEqual(["strong"]);
    expect(items(sources, "proposals").map((action) => action.label)).toEqual([
      "Review your proposal",
      "Review the client conversation"
    ]);
  });

  it("shows only pending evidence and staged publications with usable workspace links", () => {
    const sources = empty();
    sources.facts = [
      {
        id: "pending",
        review_status: "candidate",
        currentVersion: { statement: "Check against the source" }
      },
      { id: "verified", review_status: "approved" }
    ];
    sources.publications = [
      { id: "staged", status: "staged", version: 3 },
      { id: "live", status: "published", version: 2 }
    ];
    expect(items(sources, "facts")).toHaveLength(1);
    expect(items(sources, "facts")[0]?.href).toBe("/career-brain");
    expect(items(sources, "publication")).toHaveLength(1);
    expect(items(sources, "publication")[0]?.href).toBe("/career-brain#publication");
  });

  it("bounds visible actions without losing the total and leaves empty workspaces genuinely empty", () => {
    const sources = empty();
    expect(buildDashboardActions(sources, now).actions).toEqual([]);
    sources.applications = Array.from({ length: 8 }, (_, id) => ({
      id: String(id),
      status: "draft"
    }));
    const group = buildDashboardActions(sources, now).groups.find(
      (entry) => entry.id === "applications"
    );
    expect(group?.total).toBe(8);
    expect(group?.items).toHaveLength(5);
  });
});
