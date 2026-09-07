"use client";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
interface PortfolioReport {
  totalEvents: number;
  visitors: number | null;
  metrics: Record<string, { count: number | null }>;
  breakdowns: {
    sources: Record<string, { count: number | null }>;
    countries: Record<string, { count: number | null }>;
    pages: Record<string, { count: number | null }>;
    sections: Record<string, { count: number | null }>;
  };
  engagement: {
    pages: Record<string, EngagementMetric>;
    sections: Record<string, EngagementMetric>;
  };
  privacy: { message: string };
}
interface EngagementMetric {
  samples: number | null;
  totalSeconds: number | null;
  averageSeconds: number | null;
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
function PrivateCountTable({
  caption,
  values
}: {
  caption: string;
  values: Record<string, { count: number | null }>;
}) {
  return (
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Group</th>
          <th scope="col">Count</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(values).map(([name, metric]) => (
          <tr key={name}>
            <th scope="row">{name.replaceAll("_", " ")}</th>
            <td>{metric.count ?? "Suppressed (fewer than 5)"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function EngagementTable({
  caption,
  values
}: {
  caption: string;
  values: Record<string, EngagementMetric>;
}) {
  return (
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Area</th>
          <th scope="col">Samples</th>
          <th scope="col">Average time</th>
          <th scope="col">Total time</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(values).map(([name, metric]) => (
          <tr key={name}>
            <th scope="row">{name.replaceAll("_", " ")}</th>
            <td>{metric.samples ?? "Suppressed"}</td>
            <td>
              {metric.averageSeconds === null ? "Suppressed" : `${String(metric.averageSeconds)}s`}
            </td>
            <td>
              {metric.totalSeconds === null ? "Suppressed" : `${String(metric.totalSeconds)}s`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function displayName(value: string): string {
  return value.replaceAll("_", " ");
}
function numericCounts(values: Record<string, { count: number | null }>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(values).flatMap(([name, metric]) =>
      typeof metric.count === "number" ? [[name, metric.count]] : []
    )
  );
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
function Kpi({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <article className="analytics-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
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
        )
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
      setState("ready");
    } catch {
      setState("error");
    }
  }, [query]);
  useEffect(() => {
    void load();
  }, [load]);
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(paramsFrom(new FormData(event.currentTarget)).toString());
  }
  const portfolioMetrics = portfolio ? numericCounts(portfolio.metrics) : {};
  const sourceMetrics = portfolio ? numericCounts(portfolio.breakdowns.sources) : {};
  const countryMetrics = portfolio ? numericCounts(portfolio.breakdowns.countries) : {};
  const pageMetrics = portfolio ? numericCounts(portfolio.breakdowns.pages) : {};
  const sectionMetrics = portfolio ? numericCounts(portfolio.breakdowns.sections) : {};
  const pageEngagement = portfolio
    ? Object.fromEntries(
        Object.entries(portfolio.engagement.pages).flatMap(([name, metric]) =>
          typeof metric.averageSeconds === "number" ? [[name, metric.averageSeconds]] : []
        )
      )
    : {};
  const sectionEngagement = portfolio
    ? Object.fromEntries(
        Object.entries(portfolio.engagement.sections).flatMap(([name, metric]) =>
          typeof metric.averageSeconds === "number" ? [[name, metric.averageSeconds]] : []
        )
      )
    : {};
  const sectionTimeSpent = portfolio
    ? Object.fromEntries(
        Object.entries(portfolio.engagement.sections).flatMap(([name, metric]) =>
          typeof metric.totalSeconds === "number" ? [[name, metric.totalSeconds]] : []
        )
      )
    : {};
  return (
    <main className="workspace-page analytics-page">
      <header className="workspace-heading analytics-heading">
        <div>
          <p className="eyebrow">Decision support</p>
          <h1>Analytics</h1>
          <p>One view of portfolio reach, application momentum, interview signals, and career gaps.</p>
        </div>
        <span className="analytics-live-label"><i /> Private workspace</span>
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
          <label>Role<input name="role" placeholder="Data Engineer" /></label>
          <label>Country<input name="country" placeholder="Rwanda" /></label>
          <label>Source ID<input name="source" placeholder="Optional source" /></label>
          <label>Work model<input name="workModel" placeholder="Remote" /></label>
          <label>Min match<input name="minMatch" type="number" /></label>
          <label>Min opportunity<input name="minOpportunity" type="number" /></label>
          <label>Min compensation<input name="minComp" type="number" /></label>
          <label>Max compensation<input name="maxComp" type="number" /></label>
          <label>From<input name="from" type="date" /></label>
          <label>To<input name="to" type="date" /></label>
        </div>
        <div className="analytics-filter-actions">
          <button type="submit">Apply filters</button>
          <button type="reset" onClick={() => { setQuery(""); }}>Clear</button>
        </div>
      </form>
      {state === "loading" ? <p role="status">Rebuilding analytics view…</p> : null}
      {state === "error" ? <p role="alert">Private analytics could not be loaded.</p> : null}
      {state === "ready" && portfolio && applications && interviews && career ? (
        <div className="analytics-dashboard">
          <section className="analytics-hero-panel">
            <div className="analytics-panel-heading">
              <div>
                <span className="eyebrow">At a glance</span>
                <h2>What is moving?</h2>
              </div>
              <p>{portfolio.privacy.message}</p>
            </div>
            <div className="analytics-kpi-grid">
              <Kpi label="Portfolio visitors" value={portfolio.visitors === null ? "—" : String(portfolio.visitors)} detail="Privacy-safe unique visitors" />
              <Kpi label="Accepted events" value={String(portfolio.totalEvents)} detail="Across your public portfolio" />
              <Kpi label="Applications" value={String(applications.totals.applications)} detail="Tracked in the workspace" />
              <Kpi label="Interview stages" value={`${String(interviews.totals.completed)}/${String(interviews.totals.stages)}`} detail="Completed versus recorded" />
              <Kpi label="Evidence gaps" value={String(career.gaps.length)} detail={`${String(career.sampledRequirements)} market requirements sampled`} />
            </div>
          </section>

          <section className="analytics-panel analytics-wide">
            <div className="analytics-panel-heading">
              <div><span className="eyebrow">Public portfolio</span><h2>Reach & engagement</h2></div>
              <span className="analytics-panel-note">Anonymous by design</span>
            </div>
            <div className="analytics-chart-grid analytics-chart-grid-four">
              <BarList title="Activity" values={portfolioMetrics} />
              <BarList title="Referral sources" values={sourceMetrics} />
              <BarList title="Pages viewed" values={pageMetrics} />
              <BarList title="Sections viewed" values={sectionMetrics} />
            </div>
            <div className="analytics-chart-grid analytics-chart-grid-three">
              <BarList title="Average seconds by page" values={pageEngagement} suffix="s" />
              <BarList title="Average seconds by section" values={sectionEngagement} suffix="s" />
              <BarList title="Total seconds by section" values={sectionTimeSpent} suffix="s" />
            </div>
            <details className="analytics-data-details">
              <summary>View countries and complete privacy-safe tables</summary>
              <div className="analytics-table-grid">
                <BarList title="Visitor countries" values={countryMetrics} />
                <PrivateCountTable caption="Portfolio activity" values={portfolio.metrics} />
                <PrivateCountTable caption="Pages" values={portfolio.breakdowns.pages} />
                <EngagementTable caption="Page engagement detail" values={portfolio.engagement.pages} />
                <EngagementTable caption="Section time breakdown" values={portfolio.engagement.sections} />
              </div>
            </details>
          </section>

          <div className="analytics-dashboard-grid">
            <section className="analytics-panel">
              <div className="analytics-panel-heading">
                <div><span className="eyebrow">Career operations</span><h2>Application funnel</h2></div>
                <strong className="analytics-score">{applications.totals.conversionRate === null ? "—" : `${String(Math.round(applications.totals.conversionRate * 100))}%`}<small>conversion</small></strong>
              </div>
              <BarList title={`${String(applications.totals.applications)} applications`} values={applications.funnel} />
              <div className={`analytics-callout ${applications.reconciliation.length ? "is-warning" : ""}`}>
                {applications.reconciliation.length ? `${String(applications.reconciliation.length)} lifecycle item(s) need reconciliation.` : "Job and application lifecycle sources agree."}
              </div>
              {applications.reconciliation.length ? <ul className="analytics-compact-list">{applications.reconciliation.slice(0, 4).map((item) => <li key={item.applicationId}>{item.applicationStatus} / {item.jobStatus} — {item.action}</li>)}</ul> : null}
            </section>
            <section className="analytics-panel">
              <div className="analytics-panel-heading">
                <div><span className="eyebrow">Interview readiness</span><h2>Interview signals</h2></div>
                <strong className="analytics-score">{interviews.totals.stages ? Math.round((interviews.totals.completed / interviews.totals.stages) * 100) : 0}%<small>complete</small></strong>
              </div>
              <div className="analytics-chart-grid analytics-chart-grid-two">
                <BarList title="Stage types" values={interviews.stageTypes} />
                <BarList title="Recurring topics" values={interviews.recurringTopics} />
              </div>
              {interviews.recommendations.length ? <ul className="analytics-compact-list analytics-recommendations">{interviews.recommendations.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul> : <p className="analytics-empty">Approve more debrief insights to generate recommendations.</p>}
            </section>
          </div>

          <section className="analytics-panel analytics-wide">
            <div className="analytics-panel-heading">
              <div><span className="eyebrow">Career Brain</span><h2>Evidence gaps to close</h2></div>
              <span className="analytics-panel-note">Assessment required never means absent</span>
            </div>
            {career.gaps.length ? (
              <div className="analytics-gap-list">
                {career.gaps.map((gap) => (
                  <article key={gap.skill}>
                    <div><h3>{gap.skill}</h3><span>{gap.status.replaceAll("_", " ")}</span></div>
                    <strong>{gap.demandCount}<small> demand mentions</small></strong>
                    <p>{gap.actions.join(" ") || "No action needed."}</p>
                  </article>
                ))}
              </div>
            ) : <p className="analytics-empty">No evidence gaps were identified in the sampled requirements.</p>}
          </section>
        </div>
      ) : null}
    </main>
  );
}
