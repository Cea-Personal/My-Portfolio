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
  logical_date: string;
  started_at?: string | null;
  finished_at?: string | null;
  result_counts: Record<string, unknown>;
  error_summary?: string | null;
}
interface JobSourceSummary {
  id: string;
  name: string;
  adapter_type: string;
  enabled: boolean;
  health_status: string;
  last_run_at?: string | null;
  last_discovered_count?: number;
  last_accepted_count?: number;
}
interface LiveJobCandidate {
  title: string;
  company: string;
  location?: string;
  canonicalUrl: string;
  description?: string;
  postedAt?: string;
  sourceName?: string;
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
function runTimestamp(run: SearchRun): string {
  return run.started_at ?? run.finished_at ?? `${run.logical_date}T00:00:00.000Z`;
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
  const [sources, setSources] = useState<JobSourceSummary[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<"active" | "all" | JobStatus>("active");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [detail, setDetail] = useState<Job | null>(null);
  const [liveProfileId, setLiveProfileId] = useState("");
  const [liveJobs, setLiveJobs] = useState<LiveJobCandidate[]>([]);
  const [liveSearching, setLiveSearching] = useState(false);
  const [savedLiveUrls, setSavedLiveUrls] = useState<string[]>([]);
  const load = useCallback(async () => {
    try {
      const [jobsResponse, profilesResponse, runsResponse, sourcesResponse] = await Promise.all([
        fetch("/api/v1/jobs", { cache: "no-store" }),
        fetch("/api/v1/search-profiles", { cache: "no-store" }),
        fetch("/api/v1/job-search-runs", { cache: "no-store" }),
        fetch("/api/v1/job-sources", { cache: "no-store" })
      ]);
      if (!jobsResponse.ok || !profilesResponse.ok || !runsResponse.ok || !sourcesResponse.ok)
        throw new Error();
      const jobsPayload = (await jobsResponse.json()) as { data?: { jobs?: Job[] } };
      const profilesPayload = (await profilesResponse.json()) as {
        data?: { profiles?: SearchProfile[] };
      };
      const runsPayload = (await runsResponse.json()) as { data?: { runs?: SearchRun[] } };
      const sourcesPayload = (await sourcesResponse.json()) as {
        data?: { sources?: JobSourceSummary[] };
      };
      const nextSources = sourcesPayload.data?.sources ?? [];
      setJobs(jobsPayload.data?.jobs ?? []);
      setProfiles(profilesPayload.data?.profiles ?? []);
      setLiveProfileId(
        (current) =>
          current || profilesPayload.data?.profiles?.find((profile) => profile.enabled)?.id || ""
      );
      setRuns(runsPayload.data?.runs ?? []);
      setSources(nextSources);
      setSelectedSourceIds((current) => {
        const enabled = nextSources.filter((source) => source.enabled).map((source) => source.id);
        return current.length ? current.filter((id) => enabled.includes(id)) : enabled;
      });
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);
  useEffect(() => void load(), [load]);
  const visibleJobs = useMemo(
    () =>
      jobs.filter((job) =>
        filter === "active"
          ? !["expired", "rejected", "withdrawn"].includes(job.status)
          : filter === "all" || job.status === filter
      ),
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
    setLiveProfileId(profileId);
    if (!selectedSourceIds.length) {
      setMessage("Select at least one enabled source before starting a search.");
      return;
    }
    setMessage("Starting durable multi-source search…");
    try {
      const result = (await mutation("/api/v1/job-search-runs", "POST", {
        profileId,
        sourceIds: selectedSourceIds,
        triggerType: "manual"
      })) as { run?: { id?: string } };
      setMessage(
        `Search queued across ${String(selectedSourceIds.length)} source${selectedSourceIds.length === 1 ? "" : "s"}. Compiling results…`
      );
      await load();
      const runId = result.run?.id;
      if (!runId) return;
      let terminal = false;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const response = await fetch(`/api/v1/job-search-runs/${runId}`, { cache: "no-store" });
        if (!response.ok) break;
        const payload = (await response.json()) as {
          data?: {
            run?: {
              status?: string;
              result_counts?: Record<string, unknown>;
              error_summary?: string | null;
            };
          };
        };
        const run = payload.data?.run;
        if (!run || !["completed", "partial", "failed"].includes(run.status ?? "")) continue;
        terminal = true;
        await load();
        const persisted =
          typeof run.result_counts?.persisted === "number" ? run.result_counts.persisted : 0;
        const discovered =
          typeof run.result_counts?.discovered === "number" ? run.result_counts.discovered : 0;
        const filtered =
          typeof run.result_counts?.filtered === "number" ? run.result_counts.filtered : 0;
        const expired =
          typeof run.result_counts?.expired === "number" ? run.result_counts.expired : 0;
        const status = run.status ?? "completed";
        setMessage(
          `Search ${status}. ${String(discovered)} listing${discovered === 1 ? "" : "s"} discovered, ${String(persisted)} compiled into the opportunity pipeline${filtered ? `, ${String(filtered)} rejected by profile rules` : ""}${expired ? `, ${String(expired)} stale discovered job${expired === 1 ? "" : "s"} expired` : ""}.${run.error_summary ? ` ${run.error_summary}` : ""}`
        );
        break;
      }
      if (!terminal)
        setMessage(
          "Search is still queued. Keep the Inngest development runner running (`pnpm dev`) and check Recent durable runs again."
        );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start search.");
    }
  }
  async function liveSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!liveProfileId) {
      setMessage("Select an enabled profile before searching the live web.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const rawDomains = form.get("liveDomains");
    const domains =
      typeof rawDomains === "string"
        ? rawDomains
            .split(",")
            .map((domain) => domain.trim())
            .filter(Boolean)
        : [];
    setLiveSearching(true);
    setMessage("Searching the live web with your configured orchestrator…");
    try {
      const result = (await mutation("/api/v1/jobs/live-search", "POST", {
        profileId: liveProfileId,
        allowedDomains: domains
      })) as {
        jobs?: LiveJobCandidate[];
        elapsedMs?: number;
        groundedEvidenceCount?: number;
        discoveredCount?: number;
        filteredCount?: number;
        reviewCount?: number;
      };
      setLiveJobs(result.jobs ?? []);
      setMessage(
        `Live search found ${String(result.jobs?.length ?? 0)} eligible candidate${result.jobs?.length === 1 ? "" : "s"} from ${String(result.discoveredCount ?? result.jobs?.length ?? 0)} listing${result.discoveredCount === 1 ? "" : "s"}; ${String(result.filteredCount ?? 0)} filtered and ${String(result.reviewCount ?? 0)} kept for review by your profile. Grounded with ${String(result.groundedEvidenceCount ?? 0)} private evidence snippet${result.groundedEvidenceCount === 1 ? "" : "s"}. Review and save the ones you want.`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Live web search failed.");
    } finally {
      setLiveSearching(false);
    }
  }
  async function saveLiveJob(job: LiveJobCandidate) {
    try {
      await mutation("/api/v1/jobs", "POST", {
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
        sourceUrl: job.canonicalUrl,
        sourceProvider: "live_web"
      });
      setSavedLiveUrls((current) => [...current, job.canonicalUrl]);
      setMessage(`${job.title} was added to the opportunity pipeline.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save live result.");
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
      <section aria-labelledby="discovery-health-title">
        <h2 id="discovery-health-title">Discovery sources</h2>
        <p>
          {String(sources.filter((source) => source.enabled).length)} enabled ·{" "}
          {String(sources.filter((source) => source.health_status === "healthy").length)} healthy ·{" "}
          {String(sources.reduce((total, source) => total + (source.last_accepted_count ?? 0), 0))}{" "}
          accepted on latest source checks
        </p>
        {sources.length ? (
          <ul className="workspace-list">
            {sources.map((source) => (
              <li key={source.id}>
                <strong>{source.name}</strong> · {source.adapter_type} ·{" "}
                {source.enabled ? "enabled" : "disabled"} · {source.health_status}
                <small>
                  {source.last_run_at
                    ? ` Last checked ${new Date(source.last_run_at).toLocaleString()}.`
                    : " Not tested yet."}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p>No sources have been configured.</p>
        )}
        <p>
          <a href="/settings/job-sources">
            Configure sources, selectors, cadence, and diagnostics →
          </a>
        </p>
      </section>
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
          <fieldset>
            <legend>Sources to include</legend>
            {sources.filter((source) => source.enabled).length ? (
              sources
                .filter((source) => source.enabled)
                .map((source) => (
                  <label key={source.id}>
                    <input
                      type="checkbox"
                      checked={selectedSourceIds.includes(source.id)}
                      onChange={(event) => {
                        setSelectedSourceIds((current) =>
                          event.target.checked
                            ? [...current, source.id]
                            : current.filter((id) => id !== source.id)
                        );
                      }}
                    />{" "}
                    {source.name} ({source.adapter_type})
                  </label>
                ))
            ) : (
              <p>No enabled sources are available.</p>
            )}
          </fieldset>
          <button type="submit" disabled={!profiles.some((profile) => profile.enabled)}>
            Search selected sources
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
                  <strong>{run.status}</strong> · {new Date(runTimestamp(run)).toLocaleString()}
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
      <section aria-labelledby="live-discovery-title">
        <h2 id="live-discovery-title">Live web discovery</h2>
        <p>
          Ask the configured orchestrator to search current public listings outside your configured
          feeds. Results are filtered to approved domains, retain their source URL, and are only
          added to your private pipeline when you save them.
        </p>
        <form className="knowledge-entry-form" onSubmit={(event) => void liveSearch(event)}>
          <label>
            Search profile
            <select
              value={liveProfileId}
              onChange={(event) => {
                setLiveProfileId(event.target.value);
              }}
              required
            >
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
          <label>
            Allowed domains (comma-separated, optional)
            <input
              name="liveDomains"
              defaultValue="jobgether.com, remoteok.com, wellfound.com, greenhouse.io, lever.co, ashbyhq.com"
            />
          </label>
          <button
            type="submit"
            disabled={liveSearching || !profiles.some((profile) => profile.enabled)}
          >
            {liveSearching ? "Searching live web…" : "Search live web"}
          </button>
        </form>
        {liveJobs.length ? (
          <ul className="workspace-list">
            {liveJobs.map((job) => (
              <li key={job.canonicalUrl}>
                <h3>{job.title}</h3>
                <p>
                  {job.company} · {job.location || "Location not stated"}
                  {job.sourceName ? ` · ${job.sourceName}` : ""}
                </p>
                {job.description ? <p>{job.description}</p> : null}
                <p>
                  <a href={job.canonicalUrl} target="_blank" rel="noreferrer">
                    Open listing
                  </a>
                </p>
                <button
                  type="button"
                  disabled={savedLiveUrls.includes(job.canonicalUrl)}
                  onClick={() => void saveLiveJob(job)}
                >
                  {savedLiveUrls.includes(job.canonicalUrl)
                    ? "Saved to pipeline"
                    : "Save to pipeline"}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
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
            <option value="active">Active opportunities</option>
            <option value="all">All statuses (including history)</option>
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
              {job.job_source_references?.length ? (
                <small>
                  Compiled from {String(job.job_source_references.length)} source
                  {job.job_source_references.length === 1 ? "" : "s"}; duplicate listings are
                  merged.
                </small>
              ) : null}
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
