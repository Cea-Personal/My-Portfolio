"use client";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
interface PortfolioReport {
  totalEvents: number;
  totalVisits?: number;
  metrics: Record<string, number>;
  breakdowns: {
    pages: Record<string, number>;
    sections: Record<string, number>;
  };
  engagement: {
    pages: Record<string, EngagementMetric>;
    sections: Record<string, EngagementMetric>;
  };
  privacy: { message: string };
}
interface EngagementMetric {
  samples: number;
  totalSeconds: number;
  averageSeconds: number;
}
interface PortfolioInsight {
  title: string;
  observation: string;
  implication: string;
  action: string;
  confidence: string;
}
interface PortfolioInsights {
  summary: string;
  insights: PortfolioInsight[];
  nextSteps: string[];
  generatedAt: string;
  fallback?: boolean;
  fallbackReason?: string;
}
interface ApplicationReport {
  funnel: Record<string, number>;
  totals: { applications: number; conversionRate: number | null };
  reconciliation: Array<{
    applicationId: string;
    applicationStatus: string;
    jobStatus: string;
    action: string;
  }>;
}
interface InterviewReport {
  totals: { stages: number; completed: number };
  stageTypes: Record<string, number>;
  recurringTopics: Record<string, number>;
  recommendations: string[];
}
interface GapReport {
  gaps: Array<{ skill: string; demandCount: number; status: string; actions: string[] }>;
  sampledRequirements: number;
}
interface JobReport {
  totals: {
    jobs: number;
    active: number;
    rejected: number;
    expired: number;
    withDescriptions: number;
    searchRuns: number;
    failedSearchRuns: number;
  };
  statusBreakdown: Record<string, number>;
  sourceBreakdown: Record<string, number>;
  eligibilityBreakdown: Record<string, number>;
  roleBreakdown: Record<string, number>;
  discoveryByDay: Record<string, number>;
  searchRunStatus: Record<string, number>;
  searchTriggerTypes: Record<string, number>;
  sourcePerformance: Array<{
    id: string;
    name: string;
    adapterType: string;
    listings: number;
    fetched: number;
    accepted: number;
    rejected: number;
    failures: number;
  }>;
  recentRuns: Array<{
    id: string;
    status: string;
    triggerType: string;
    logicalDate: string;
    discovered: number;
    persisted: number;
    filtered: number;
    errorSummary?: string | null;
  }>;
}
function displayName(value: string): string {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}
function BarList({
  title,
  values,
  suffix = "",
  empty = "Not enough privacy-safe volume yet."
}: {
  title: string;
  values: Record<string, number>;
  suffix?: string;
  empty?: string;
}) {
  const rows = Object.entries(values)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 7);
  const maximum = Math.max(1, ...rows.map(([, value]) => value));
  return (
    <div className="analytics-bar-list">
      <h3>{title}</h3>
      {rows.length ? (
        <ul>
          {rows.map(([name, value]) => (
            <li key={name}>
              <div className="analytics-bar-label">
                <span>{displayName(name)}</span>
                <strong>{`${String(value)}${suffix}`}</strong>
              </div>
              <span className="analytics-bar-track" aria-hidden="true">
                <span style={{ width: `${String(Math.max(5, (value / maximum) * 100))}%` }} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="analytics-empty">{empty}</p>
      )}
    </div>
  );
}
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${String(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${String(minutes)}m ${String(remainder)}s` : `${String(minutes)}m`;
}
function SummaryMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="analytics-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
function paramsFrom(form: FormData) {
  const params = new URLSearchParams();
  for (const key of [
    "role",
    "country",
    "source",
    "workModel",
    "minMatch",
    "minOpportunity",
    "minComp",
    "maxComp",
    "from",
    "to"
  ]) {
    const value = form.get(key);
    if (typeof value === "string" && value.trim()) params.set(key, value.trim());
  }
  return params;
}
export function AnalyticsWorkspace() {
  const [query, setQuery] = useState("");
  const [portfolio, setPortfolio] = useState<PortfolioReport | null>(null);
  const [applications, setApplications] = useState<ApplicationReport | null>(null);
  const [interviews, setInterviews] = useState<InterviewReport | null>(null);
  const [career, setCareer] = useState<GapReport | null>(null);
  const [jobs, setJobs] = useState<JobReport | null>(null);
  const [portfolioInsights, setPortfolioInsights] = useState<PortfolioInsights | null>(null);
  const [insightsError, setInsightsError] = useState("");
  const [insightsState, setInsightsState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const load = useCallback(async () => {
    setState("loading");
    const shared = query ? `?${query}` : "";
    const limited = (removed: string[]) => {
      const params = new URLSearchParams(query);
      removed.forEach((key) => {
        params.delete(key);
      });
      return params.size ? `?${params}` : "";
    };
    try {
      const responses = await Promise.all([
        fetch(
          `/api/v1/analytics/portfolio${limited(["role", "country", "source", "workModel", "minMatch", "minOpportunity", "minComp", "maxComp"])}`,
          { cache: "no-store" }
        ),
        fetch(`/api/v1/analytics/applications${shared}`, { cache: "no-store" }),
        fetch(
          `/api/v1/analytics/interviews${limited(["role", "country", "source", "workModel", "minMatch", "minOpportunity", "minComp", "maxComp"])}`,
          { cache: "no-store" }
        ),
        fetch(
          `/api/v1/analytics/career-gaps${limited(["source", "workModel", "minMatch", "minOpportunity", "minComp", "maxComp"])}`,
          { cache: "no-store" }
        ),
        fetch(`/api/v1/analytics/jobs${shared}`, { cache: "no-store" })
      ]);
      if (responses.some((response) => !response.ok)) throw new Error();
      const payloads = (await Promise.all(
        responses.map(async (response) => {
          const payload: unknown = await response.json();
          return payload;
        })
      )) as Array<{ data?: unknown }>;
      setPortfolio(payloads[0]?.data as PortfolioReport);
      setApplications(payloads[1]?.data as ApplicationReport);
      setInterviews(payloads[2]?.data as InterviewReport);
      setCareer(payloads[3]?.data as GapReport);
      setJobs(payloads[4]?.data as JobReport);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [query]);
  useEffect(() => {
    void load();
  }, [load]);
  const loadInsights = useCallback(async () => {
    setInsightsState("loading");
    setInsightsError("");
    const params = new URLSearchParams(query);
    for (const key of [
      "role",
      "country",
      "source",
      "workModel",
      "minMatch",
      "minOpportunity",
      "minComp",
      "maxComp"
    ]) {
      params.delete(key);
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      controller.abort();
    }, 130_000);
    try {
      const response = await fetch(
        `/api/v1/analytics/portfolio/insights${params.size ? `?${params.toString()}` : ""}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": `portfolio-insights-${crypto.randomUUID()}`
          },
          body: "{}",
          signal: controller.signal
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        data?: PortfolioInsights & { detail?: string; code?: string };
      };
      if (!response.ok) {
        throw new Error(
          payload.data?.detail ?? payload.data?.code ?? `Request failed (${String(response.status)})`
        );
      }
      if (!payload.data) throw new Error("The analytics subagent returned no output.");
      setPortfolioInsights(payload.data);
      setInsightsState("ready");
    } catch (error) {
      setInsightsError(
        error instanceof DOMException && error.name === "AbortError"
          ? "The analytics subagent timed out after 130 seconds. Check the orchestrator health and try again."
          : error instanceof Error
            ? error.message
            : "The analytics subagent could not complete the request."
      );
      setInsightsState("error");
    } finally {
      window.clearTimeout(timeout);
    }
  }, [query]);
  useEffect(() => {
    if (state === "ready" && portfolio) void loadInsights();
  }, [loadInsights, portfolio, state]);
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(paramsFrom(new FormData(event.currentTarget)).toString());
  }
  const portfolioMetrics = portfolio?.metrics ?? {};
  const portfolioPages = portfolio?.breakdowns.pages ?? {};
  const portfolioSections = portfolio?.breakdowns.sections ?? {};
  const pageAverageTime = portfolio
    ? Object.fromEntries(
        Object.entries(portfolio.engagement.pages).map(([name, metric]) => [
          name,
          metric.averageSeconds
        ])
      )
    : {};
  const sectionAverageTime = portfolio
    ? Object.fromEntries(
        Object.entries(portfolio.engagement.sections).map(([name, metric]) => [
          name,
          metric.averageSeconds
        ])
      )
    : {};
  const sectionTotalTime = portfolio
    ? Object.fromEntries(
        Object.entries(portfolio.engagement.sections).map(([name, metric]) => [
          name,
          metric.totalSeconds
        ])
      )
    : {};
  const totalMeasuredSeconds = portfolio
    ? Object.values(portfolio.engagement.sections).reduce(
        (total, metric) => total + metric.totalSeconds,
        0
      )
    : 0;
  return (
    <main className="workspace-page analytics-page">
      <header className="workspace-heading analytics-heading">
        <div>
          <p className="eyebrow">Decision support</p>
          <h1>Analytics</h1>
          <p>Portfolio activity, application momentum, interview signals, and career gaps.</p>
        </div>
        <span className="analytics-live-label">
          <i /> Private workspace
        </span>
      </header>
      <form className="knowledge-entry-form analytics-filter-bar" onSubmit={filter}>
        <div className="analytics-filter-heading">
          <div>
            <span className="eyebrow">View controls</span>
            <h2>Filter the signal</h2>
          </div>
          <p>Filters are allowlisted and privacy-safe.</p>
        </div>
        <div className="analytics-filter-fields">
          <label>
            Role
            <input name="role" placeholder="Data Engineer" />
          </label>
          <label>
            Country
            <input name="country" placeholder="Rwanda" />
          </label>
          <label>
            Source ID
            <input name="source" placeholder="Optional source" />
          </label>
          <label>
            Work model
            <input name="workModel" placeholder="Remote" />
          </label>
          <label>
            Min match
            <input name="minMatch" type="number" />
          </label>
          <label>
            Min opportunity
            <input name="minOpportunity" type="number" />
          </label>
          <label>
            Min compensation
            <input name="minComp" type="number" />
          </label>
          <label>
            Max compensation
            <input name="maxComp" type="number" />
          </label>
          <label>
            From
            <input name="from" type="date" />
          </label>
          <label>
            To
            <input name="to" type="date" />
          </label>
        </div>
        <div className="analytics-filter-actions">
          <button type="submit">Apply filters</button>
          <button
            type="reset"
            onClick={() => {
              setQuery("");
            }}
          >
            Clear
          </button>
        </div>
      </form>
      {state === "loading" ? <p role="status">Rebuilding analytics view…</p> : null}
      {state === "error" ? <p role="alert">Private analytics could not be loaded.</p> : null}
      {state === "ready" && portfolio && applications && interviews && career && jobs ? (
        <div className="analytics-dashboard">
          <section className="analytics-panel analytics-wide">
            <div className="analytics-panel-heading">
              <div>
                <span className="eyebrow">Public portfolio</span>
                <h2>Summary dashboard</h2>
              </div>
              <span className="analytics-panel-note">Page and section activity only</span>
            </div>
            <p className="analytics-activity-privacy">{portfolio.privacy.message}</p>
            <div className="analytics-kpi-grid">
              <SummaryMetric
                label="Page views"
                value={String(portfolioMetrics.page_view ?? 0)}
                detail="Portfolio home page"
              />
              <SummaryMetric
                label="Section views"
                value={String(portfolioMetrics.section_view ?? 0)}
                detail="Sections opened"
              />
              <SummaryMetric
                label="Visits"
                value={String(portfolio.totalVisits ?? 0)}
                detail="Anonymous sessions"
              />
              <SummaryMetric
                label="Events captured"
                value={String(portfolio.totalEvents)}
                detail="Portfolio activity"
              />
              <SummaryMetric
                label="Time recorded"
                value={formatDuration(totalMeasuredSeconds)}
                detail="Section dwell time"
              />
            </div>
            <div className="analytics-chart-grid analytics-chart-grid-four">
              <BarList title="Activity" values={portfolioMetrics} />
              <BarList title="Pages viewed" values={portfolioPages} />
              <BarList title="Sections viewed" values={portfolioSections} />
              <BarList title="Average seconds by section" values={sectionAverageTime} suffix="s" />
            </div>
            <div className="analytics-chart-grid analytics-chart-grid-three">
              <BarList title="Average seconds by page" values={pageAverageTime} suffix="s" />
              <BarList title="Total seconds by section" values={sectionTotalTime} suffix="s" />
            </div>
            <section className="analytics-insights" aria-labelledby="portfolio-insights-title">
              <div className="analytics-panel-heading">
                <div>
                  <span className="eyebrow">Subagent readout</span>
                  <h3 id="portfolio-insights-title">What the portfolio signal suggests</h3>
                </div>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={insightsState === "loading"}
                  onClick={() => void loadInsights()}
                >
                  {insightsState === "loading" ? "Analyzing…" : "Refresh insights"}
                </button>
              </div>
              {insightsState === "loading" ? (
                <p role="status">
                  The portfolio analytics subagent is reading the aggregate signal…
                </p>
              ) : null}
              {insightsState === "error" ? (
                <p role="alert">
                  {insightsError ||
                    "Insights are temporarily unavailable. The summary dashboard is still available."}
                </p>
              ) : null}
              {insightsState === "ready" && portfolioInsights ? (
                <>
                  <p className="analytics-insights-summary">{portfolioInsights.summary}</p>
                  {portfolioInsights.insights.length ? (
                    <div className="analytics-insight-list">
                      {portfolioInsights.insights.map((insight) => (
                        <article key={`${insight.title}-${insight.observation}`}>
                          <div className="analytics-insight-heading">
                            <h4>{insight.title}</h4>
                            <span>{insight.confidence || "Unspecified confidence"}</span>
                          </div>
                          <p>{insight.observation}</p>
                          <p>
                            <strong>Why it matters:</strong> {insight.implication}
                          </p>
                          <p>
                            <strong>Try next:</strong> {insight.action}
                          </p>
                        </article>
                      ))}
                    </div>
                  ) : null}
                  {portfolioInsights.nextSteps.length ? (
                    <div className="analytics-next-steps">
                      <strong>Suggested next steps</strong>
                      <ul>
                        {portfolioInsights.nextSteps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <small>
                    {portfolioInsights.fallback
                      ? `Aggregate fallback readout. The subagent was unavailable: ${portfolioInsights.fallbackReason ?? "unknown error"}`
                      : `Generated ${new Date(portfolioInsights.generatedAt).toLocaleString()} from aggregate portfolio activity only.`}
                  </small>
                </>
              ) : null}
            </section>
          </section>

          <section className="analytics-panel analytics-wide">
            <div className="analytics-panel-heading">
              <div>
                <span className="eyebrow">Job discovery</span>
                <h2>Opportunity pipeline</h2>
              </div>
              <span className="analytics-panel-note">Search runs and saved opportunities</span>
            </div>
            <div className="analytics-kpi-grid">
              <SummaryMetric
                label="Jobs saved"
                value={String(jobs.totals.jobs)}
                detail="Matched private pipeline"
              />
              <SummaryMetric
                label="Active"
                value={String(jobs.totals.active)}
                detail="Not closed or expired"
              />
              <SummaryMetric
                label="Search runs"
                value={String(jobs.totals.searchRuns)}
                detail={`${String(jobs.totals.failedSearchRuns)} failed`}
              />
              <SummaryMetric
                label="With descriptions"
                value={String(jobs.totals.withDescriptions)}
                detail="Ready for matching"
              />
              <SummaryMetric
                label="Rejected"
                value={String(jobs.totals.rejected)}
                detail={`${String(jobs.totals.expired)} expired`}
              />
            </div>
            <div className="analytics-chart-grid analytics-chart-grid-four">
              <BarList title="Pipeline status" values={jobs.statusBreakdown} />
              <BarList title="Jobs by source" values={jobs.sourceBreakdown} />
              <BarList title="Eligibility outcome" values={jobs.eligibilityBreakdown} />
              <BarList title="Search run status" values={jobs.searchRunStatus} />
            </div>
            <div className="analytics-chart-grid analytics-chart-grid-three">
              <BarList title="Roles discovered" values={jobs.roleBreakdown} />
              <BarList title="Discovery by day" values={jobs.discoveryByDay} />
              <BarList title="Search trigger" values={jobs.searchTriggerTypes} />
            </div>
            <div className="analytics-dashboard-grid">
              <div>
                <h3>Source performance</h3>
                {jobs.sourcePerformance.length ? (
                  <ul className="analytics-compact-list">
                    {jobs.sourcePerformance.map((source) => (
                      <li key={source.id}>
                        <strong>{source.name}</strong> ({source.adapterType}) · {source.listings}{" "}
                        listing{source.listings === 1 ? "" : "s"} · {source.accepted} accepted ·{" "}
                        {source.rejected} rejected · {source.failures} failed source runs
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="analytics-empty">No configured job sources have run yet.</p>
                )}
              </div>
              <div>
                <h3>Recent search runs</h3>
                {jobs.recentRuns.length ? (
                  <ul className="analytics-compact-list">
                    {jobs.recentRuns.map((run) => (
                      <li key={run.id}>
                        <strong>{run.logicalDate}</strong> · {displayName(run.triggerType)} ·{" "}
                        {displayName(run.status)} · {run.discovered} discovered · {run.persisted}{" "}
                        saved · {run.filtered} filtered
                        {run.errorSummary ? ` — ${run.errorSummary}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="analytics-empty">No job searches have been recorded yet.</p>
                )}
              </div>
            </div>
          </section>

          <div className="analytics-dashboard-grid">
            <section className="analytics-panel">
              <div className="analytics-panel-heading">
                <div>
                  <span className="eyebrow">Career operations</span>
                  <h2>Application funnel</h2>
                </div>
                <strong className="analytics-score">
                  {applications.totals.conversionRate === null
                    ? "—"
                    : `${String(Math.round(applications.totals.conversionRate * 100))}%`}
                  <small>conversion</small>
                </strong>
              </div>
              <BarList
                title={`${String(applications.totals.applications)} applications`}
                values={applications.funnel}
              />
              <div
                className={`analytics-callout ${applications.reconciliation.length ? "is-warning" : ""}`}
              >
                {applications.reconciliation.length
                  ? `${String(applications.reconciliation.length)} lifecycle item(s) need reconciliation.`
                  : "Job and application lifecycle sources agree."}
              </div>
              {applications.reconciliation.length ? (
                <ul className="analytics-compact-list">
                  {applications.reconciliation.slice(0, 4).map((item) => (
                    <li key={item.applicationId}>
                      {item.applicationStatus} / {item.jobStatus} — {item.action}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
            <section className="analytics-panel">
              <div className="analytics-panel-heading">
                <div>
                  <span className="eyebrow">Interview readiness</span>
                  <h2>Interview signals</h2>
                </div>
                <strong className="analytics-score">
                  {interviews.totals.stages
                    ? Math.round((interviews.totals.completed / interviews.totals.stages) * 100)
                    : 0}
                  %<small>complete</small>
                </strong>
              </div>
              <div className="analytics-chart-grid analytics-chart-grid-two">
                <BarList title="Stage types" values={interviews.stageTypes} />
                <BarList title="Recurring topics" values={interviews.recurringTopics} />
              </div>
              {interviews.recommendations.length ? (
                <ul className="analytics-compact-list analytics-recommendations">
                  {interviews.recommendations.slice(0, 4).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="analytics-empty">
                  Approve more debrief insights to generate recommendations.
                </p>
              )}
            </section>
          </div>

          <section className="analytics-panel analytics-wide">
            <div className="analytics-panel-heading">
              <div>
                <span className="eyebrow">Career Brain</span>
                <h2>Evidence gaps to close</h2>
              </div>
              <span className="analytics-panel-note">Assessment required never means absent</span>
            </div>
            {career.gaps.length ? (
              <div className="analytics-gap-list">
                {career.gaps.map((gap) => (
                  <article key={gap.skill}>
                    <div>
                      <h3>{gap.skill}</h3>
                      <span>{gap.status.replaceAll("_", " ")}</span>
                    </div>
                    <strong>
                      {gap.demandCount}
                      <small> demand mentions</small>
                    </strong>
                    <p>{gap.actions.join(" ") || "No action needed."}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="analytics-empty">
                No evidence gaps were identified in the sampled requirements.
              </p>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}
