"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type JobStatus =
  | "discovered"
  | "shortlisted"
  | "interested"
  | "preparing_application"
  | "ready_to_apply"
  | "applied"
  | "recruiter_contact"
  | "interview"
  | "technical_assessment"
  | "final_interview"
  | "offer"
  | "rejected"
  | "withdrawn"
  | "expired";
interface JobScore {
  id: string;
  score_type: string;
  numeric_score: number | string;
  calculation_version: string;
  evidence_snapshot: Record<string, unknown>;
  created_at: string;
}
interface SourceReference {
  id: string;
  canonical_url?: string | null;
  source_status: string;
  last_seen_at: string;
}
interface Job {
  id: string;
  canonical_title: string;
  canonical_company: string;
  location?: string | null;
  current_description?: string | null;
  source_url?: string | null;
  source_provider?: string | null;
  status: JobStatus;
  discovered_at: string;
  job_scores?: JobScore[];
  job_source_references?: SourceReference[];
  job_status_history?: Array<{
    id: string;
    from_status?: string | null;
    to_status: string;
    reason?: string | null;
    transitioned_at: string;
  }>;
  job_descriptions?: Array<{
    id: string;
    version: number;
    active: boolean;
    job_requirements?: Array<{
      id: string;
      normalized_text: string;
      priority: string;
      category: string;
      job_requirement_matches?: Array<{
        id: string;
        match_class: string;
        evidence_value?: number | null;
        explanation?: string | null;
        claim_evidence_ids: string[];
      }>;
    }>;
  }>;
}
interface SearchProfile {
  id: string;
  name: string;
  enabled: boolean;
}
interface SearchRun {
  id: string;
  status: string;
  created_at: string;
  result_counts: Record<string, unknown>;
  error_summary?: string | null;
}

const transitions: Record<JobStatus, JobStatus[]> = {
  discovered: ["shortlisted", "interested", "withdrawn", "expired"],
  shortlisted: ["interested", "preparing_application", "rejected", "withdrawn", "expired"],
  interested: ["preparing_application", "withdrawn", "expired"],
  preparing_application: ["ready_to_apply", "interested", "withdrawn", "expired"],
  ready_to_apply: ["preparing_application", "applied", "withdrawn", "expired"],
  applied: [
    "recruiter_contact",
    "interview",
    "technical_assessment",
    "rejected",
    "withdrawn",
    "expired"
  ],
  recruiter_contact: [
    "interview",
    "technical_assessment",
    "final_interview",
    "offer",
    "rejected",
    "withdrawn"
  ],
  interview: ["technical_assessment", "final_interview", "offer", "rejected", "withdrawn"],
  technical_assessment: ["final_interview", "offer", "rejected", "withdrawn"],
  final_interview: ["offer", "rejected", "withdrawn"],
  offer: ["withdrawn"],
  rejected: ["shortlisted"],
  withdrawn: ["interested"],
  expired: []
};

function scoreFor(job: Job, type: string): JobScore | undefined {
  return [...(job.job_scores ?? [])]
    .filter((score) => score.score_type === type)
    .sort((left, right) => right.created_at.localeCompare(left.created_at))[0];
}
function scoreText(score: JobScore | undefined): string {
  if (!score) return "Not calculated";
  const value = Number(score.numeric_score);
  return Number.isFinite(value) ? `${String(Math.round(value * 100))}%` : "Unavailable";
}
async function mutation(endpoint: string, method: "POST" | "PATCH", body: unknown) {
  const response = await fetch(endpoint, {
    method,
    headers: {
      "content-type": "application/json",
      "idempotency-key": `${method.toLowerCase()}-${crypto.randomUUID()}`,
      ...(method === "PATCH" ? { "if-match": "*" } : {})
    },
    body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => ({}))) as { data?: unknown };
  if (!response.ok) {
    const problem = payload.data as { detail?: string; code?: string } | undefined;
    throw new Error(problem?.detail ?? problem?.code ?? "Request failed");
  }
  return payload.data;
}

export function JobsWorkspace() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [runs, setRuns] = useState<SearchRun[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<"all" | JobStatus>("all");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [detail, setDetail] = useState<Job | null>(null);
  const load = useCallback(async () => {
    try {
      const [jobsResponse, profilesResponse, runsResponse] = await Promise.all([
        fetch("/api/v1/jobs", { cache: "no-store" }),
        fetch("/api/v1/search-profiles", { cache: "no-store" }),
        fetch("/api/v1/job-search-runs", { cache: "no-store" })
      ]);
      if (!jobsResponse.ok || !profilesResponse.ok || !runsResponse.ok) throw new Error();
      const jobsPayload = (await jobsResponse.json()) as { data?: { jobs?: Job[] } };
      const profilesPayload = (await profilesResponse.json()) as {
        data?: { profiles?: SearchProfile[] };
      };
      const runsPayload = (await runsResponse.json()) as { data?: { runs?: SearchRun[] } };
      setJobs(jobsPayload.data?.jobs ?? []);
      setProfiles(profilesPayload.data?.profiles ?? []);
      setRuns(runsPayload.data?.runs ?? []);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);
  useEffect(() => void load(), [load]);
  const visibleJobs = useMemo(
    () => jobs.filter((job) => filter === "all" || job.status === filter),
    [filter, jobs]
  );
  const compared = compareIds.flatMap((id) => jobs.find((job) => job.id === id) ?? []);

  async function createJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage("Saving opportunity…");
    try {
      await mutation("/api/v1/jobs", "POST", {
        title: form.get("title"),
        company: form.get("company"),
        location: form.get("location"),
        description: form.get("description"),
        sourceUrl: form.get("sourceUrl")
      });
      event.currentTarget.reset();
      setMessage("Opportunity saved with its initial history entry.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save opportunity.");
    }
  }
  async function startSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const profileId = new FormData(event.currentTarget).get("profileId");
    if (typeof profileId !== "string" || !profileId) return;
    setMessage("Starting durable multi-source search…");
    try {
      await mutation("/api/v1/job-search-runs", "POST", { profileId, triggerType: "manual" });
      setMessage("Search queued. Refresh the run history to see source-level outcomes.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start search.");
    }
  }
  async function loadDetail(id: string) {
    setMessage("Loading opportunity evidence…");
    try {
      const response = await fetch(`/api/v1/jobs/${id}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Opportunity unavailable");
      const payload = (await response.json()) as { data?: { job?: Job } };
      setDetail(payload.data?.job ?? null);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load opportunity.");
    }
  }
  async function updateJob(event: FormEvent<HTMLFormElement>, job: Job) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await mutation(`/api/v1/jobs/${job.id}`, "PATCH", {
        title: form.get("title"),
        company: form.get("company"),
        location: form.get("location"),
        description: form.get("description"),
        sourceUrl: form.get("sourceUrl")
      });
      setMessage("Opportunity updated; description changes were versioned.");
      await load();
      await loadDetail(job.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update opportunity.");
    }
  }
  async function transition(job: Job, status: JobStatus) {
    const reason = window.prompt(`Why move this opportunity to ${status}?`)?.trim();
    if (!reason) return;
    try {
      await mutation(`/api/v1/jobs/${job.id}/transitions`, "POST", { status, reason });
      setMessage(`Opportunity moved to ${status}.`);
      await load();
      if (detail?.id === job.id) await loadDetail(job.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not change status.");
    }
  }
  function toggleCompare(id: string) {
    setCompareIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id].slice(-2)
    );
  }

  return (
    <main className="workspace-page">
      <header className="workspace-heading">
        <p className="eyebrow">Opportunity intelligence</p>
        <h1>Jobs</h1>
        <p>
          Discover, compare, inspect the evidence behind scores, and move roles through a guarded
          lifecycle.
        </p>
      </header>
      <section aria-labelledby="search-jobs-title">
        <h2 id="search-jobs-title">Run a search</h2>
        <form className="workspace-actions" onSubmit={(event) => void startSearch(event)}>
          <label>
            Enabled profile
            <select name="profileId" required defaultValue="">
              <option value="" disabled>
                Select a profile
              </option>
              {profiles
                .filter((profile) => profile.enabled)
                .map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
            </select>
          </label>
          <button type="submit" disabled={!profiles.some((profile) => profile.enabled)}>
            Search enabled sources
          </button>
        </form>
        {!profiles.some((profile) => profile.enabled) ? (
          <p>Enable a search profile and at least one healthy job source first.</p>
        ) : null}
        <details>
          <summary>Recent durable runs</summary>
          {runs.length ? (
            <ul className="workspace-list">
              {runs.slice(0, 10).map((run) => (
                <li key={run.id}>
                  <strong>{run.status}</strong> · {new Date(run.created_at).toLocaleString()}
                  <pre>{JSON.stringify(run.result_counts, null, 2)}</pre>
                  {run.error_summary ? <p>{run.error_summary}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p>No searches have run yet.</p>
          )}
        </details>
      </section>
      <section aria-labelledby="manual-job-title">
        <h2 id="manual-job-title">Add an opportunity manually</h2>
        <form className="knowledge-entry-form" onSubmit={(event) => void createJob(event)}>
          <label>
            Role
            <input name="title" required maxLength={240} />
          </label>
          <label>
            Company
            <input name="company" required maxLength={240} />
          </label>
          <label>
            Location
            <input name="location" maxLength={240} />
          </label>
          <label>
            Job description
            <textarea name="description" rows={8} maxLength={50000} />
          </label>
          <label>
            LinkedIn job URL (optional)
            <input
              name="sourceUrl"
              type="url"
              placeholder="https://www.linkedin.com/jobs/view/..."
            />
            <small>Owner-supplied link only. The app stores it and never scrapes LinkedIn.</small>
          </label>
          <button type="submit">Save opportunity</button>
        </form>
      </section>
      <section aria-labelledby="opportunity-list-title">
        <h2 id="opportunity-list-title">Opportunity pipeline</h2>
        <label>
          Status filter
          <select
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value as "all" | JobStatus);
            }}
          >
            <option value="all">All statuses</option>
            {Object.keys(transitions).map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        {state === "loading" ? <p role="status">Loading opportunities…</p> : null}
        {state === "error" ? (
          <p role="alert">Could not load the private opportunity workspace.</p>
        ) : null}
        {state === "ready" && !visibleJobs.length ? <p>No opportunities match this view.</p> : null}
        <ul className="workspace-list">
          {visibleJobs.map((job) => (
            <li key={job.id}>
              <label>
                <input
                  type="checkbox"
                  checked={compareIds.includes(job.id)}
                  onChange={() => {
                    toggleCompare(job.id);
                  }}
                />{" "}
                Compare
              </label>
              <h3>{job.canonical_title}</h3>
              <p>
                {job.canonical_company} · {job.location || "Location not stated"} · {job.status}
              </p>
              {job.source_url || job.job_source_references?.[0]?.canonical_url ? (
                <p>
                  <a
                    href={job.source_url ?? job.job_source_references?.[0]?.canonical_url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open {job.source_provider?.includes("linkedin") ? "LinkedIn" : "source"} listing
                  </a>
                </p>
              ) : null}
              <p>
                Career match: {scoreText(scoreFor(job, "career_match"))} · Opportunity:{" "}
                {scoreText(scoreFor(job, "opportunity"))}
              </p>
              <div className="workspace-actions">
                <button type="button" onClick={() => void loadDetail(job.id)}>
                  Inspect evidence and history
                </button>
                {transitions[job.status].map((status) => (
                  <button type="button" key={status} onClick={() => void transition(job, status)}>
                    Move to {status}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>
      {compared.length ? (
        <section aria-labelledby="compare-title">
          <h2 id="compare-title">Compare selected opportunities</h2>
          <div className="career-brain-columns">
            {compared.map((job) => (
              <article key={job.id}>
                <h3>{job.canonical_title}</h3>
                <p>{job.canonical_company}</p>
                <dl>
                  <dt>Career match</dt>
                  <dd>{scoreText(scoreFor(job, "career_match"))}</dd>
                  <dt>Opportunity score</dt>
                  <dd>{scoreText(scoreFor(job, "opportunity"))}</dd>
                  <dt>Status</dt>
                  <dd>{job.status}</dd>
                </dl>
              </article>
            ))}
          </div>
          {compared.length < 2 ? <p>Select one more role for a side-by-side comparison.</p> : null}
        </section>
      ) : null}
      {detail ? (
        <section aria-labelledby="job-detail-title">
          <h2 id="job-detail-title">
            {detail.canonical_title} at {detail.canonical_company}
          </h2>
          <form
            className="knowledge-entry-form"
            onSubmit={(event) => void updateJob(event, detail)}
          >
            <label>
              Role
              <input name="title" defaultValue={detail.canonical_title} required />
            </label>
            <label>
              Company
              <input name="company" defaultValue={detail.canonical_company} required />
            </label>
            <label>
              Location
              <input name="location" defaultValue={detail.location ?? ""} />
            </label>
            <label>
              Description
              <textarea
                name="description"
                rows={10}
                defaultValue={detail.current_description ?? ""}
              />
            </label>
            <label>
              LinkedIn job URL (optional)
              <input name="sourceUrl" type="url" defaultValue={detail.source_url ?? ""} />
              <small>Stored as a reference; no automated LinkedIn requests are made.</small>
            </label>
            <button type="submit">Save edits as a new description version</button>
          </form>
          <h3>Score evidence</h3>
          {detail.job_scores?.length ? (
            <ul className="workspace-list">
              {[...detail.job_scores]
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .map((score) => (
                  <li key={score.id}>
                    <strong>
                      {score.score_type}: {scoreText(score)}
                    </strong>
                    <p>
                      {score.calculation_version} · {new Date(score.created_at).toLocaleString()}
                    </p>
                    <pre>{JSON.stringify(score.evidence_snapshot, null, 2)}</pre>
                  </li>
                ))}
            </ul>
          ) : (
            <p>No score has been calculated. This is not evidence of fit.</p>
          )}
          <h3>Requirements and matches</h3>
          {detail.job_descriptions?.flatMap((version) => version.job_requirements ?? []).length ? (
            <ul className="workspace-list">
              {detail.job_descriptions
                .flatMap((version) => version.job_requirements ?? [])
                .map((requirement) => (
                  <li key={requirement.id}>
                    <strong>
                      {requirement.priority} · {requirement.category}
                    </strong>
                    <p>{requirement.normalized_text}</p>
                    {requirement.job_requirement_matches?.length ? (
                      requirement.job_requirement_matches.map((match) => (
                        <p key={match.id}>
                          {match.match_class}: {match.explanation || "No explanation"} ·{" "}
                          {match.claim_evidence_ids.length} evidence links
                        </p>
                      ))
                    ) : (
                      <p>Not yet matched to evidence.</p>
                    )}
                  </li>
                ))}
            </ul>
          ) : (
            <p>No structured requirements have been extracted yet.</p>
          )}
          <h3>Sources</h3>
          {detail.job_source_references?.length ? (
            <ul>
              {detail.job_source_references.map((source) => (
                <li key={source.id}>
                  {source.canonical_url ? (
                    <a href={source.canonical_url} target="_blank" rel="noreferrer">
                      Open source listing
                    </a>
                  ) : (
                    "Source URL unavailable"
                  )}{" "}
                  · {source.source_status}
                </li>
              ))}
            </ul>
          ) : (
            <p>Manually added; no external source reference.</p>
          )}
          <h3>Lifecycle history</h3>
          {detail.job_status_history?.length ? (
            <ol>
              {[...detail.job_status_history]
                .sort((a, b) => a.transitioned_at.localeCompare(b.transitioned_at))
                .map((entry) => (
                  <li key={entry.id}>
                    {entry.from_status ?? "created"} → {entry.to_status} ·{" "}
                    {entry.reason || "No reason recorded"}
                  </li>
                ))}
            </ol>
          ) : (
            <p>No lifecycle history is available.</p>
          )}
          <button
            type="button"
            onClick={() => {
              setDetail(null);
            }}
          >
            Close detail
          </button>
        </section>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </main>
  );
}
