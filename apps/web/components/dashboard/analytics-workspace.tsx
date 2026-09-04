"use client";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
interface PortfolioReport {
  totalEvents: number;
  metrics: Record<string, { count: number | null }>;
  privacy: { message: string };
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
function MetricTable({ caption, values }: { caption: string; values: Record<string, number> }) {
  const maximum = Math.max(1, ...Object.values(values));
  return (
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Metric</th>
          <th scope="col">Count</th>
          <th scope="col">Relative volume</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(values).map(([name, value]) => (
          <tr key={name}>
            <th scope="row">{name.replaceAll("_", " ")}</th>
            <td>{value}</td>
            <td>
              <meter min="0" max={maximum} value={value}>
                {value} of {maximum}
              </meter>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
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
  return (
    <main className="workspace-page">
      <header className="workspace-heading">
        <p className="eyebrow">Decision support</p>
        <h1>Analytics</h1>
        <p>
          Private, source-aware metrics with low-volume privacy protection and actionable gap
          recommendations.
        </p>
      </header>
      <form className="knowledge-entry-form" onSubmit={filter}>
        <h2>Allowlisted filters</h2>
        <label>
          Role
          <input name="role" />
        </label>
        <label>
          Country
          <input name="country" />
        </label>
        <label>
          Source ID
          <input name="source" />
        </label>
        <label>
          Work model
          <input name="workModel" />
        </label>
        <label>
          Minimum match score
          <input name="minMatch" type="number" />
        </label>
        <label>
          Minimum opportunity score
          <input name="minOpportunity" type="number" />
        </label>
        <label>
          Minimum compensation
          <input name="minComp" type="number" />
        </label>
        <label>
          Maximum compensation
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
        <button type="submit">Apply filters</button>
        <button
          type="reset"
          onClick={() => {
            setQuery("");
          }}
        >
          Clear
        </button>
      </form>
      {state === "loading" ? <p role="status">Rebuilding analytics view…</p> : null}
      {state === "error" ? <p role="alert">Private analytics could not be loaded.</p> : null}
      {state === "ready" && portfolio ? (
        <section>
          <h2>Portfolio</h2>
          <p>{portfolio.privacy.message}</p>
          <p>Total accepted events: {portfolio.totalEvents}</p>
          <table>
            <caption>Privacy-safe portfolio activity</caption>
            <thead>
              <tr>
                <th>Event</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(portfolio.metrics).map(([name, metric]) => (
                <tr key={name}>
                  <th scope="row">{name}</th>
                  <td>{metric.count ?? "Suppressed (fewer than 5)"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      {state === "ready" && applications ? (
        <section>
          <h2>Applications</h2>
          <p>
            {applications.totals.applications} applications · conversion{" "}
            {applications.totals.conversionRate === null
              ? "Insufficient volume"
              : `${String(Math.round(applications.totals.conversionRate * 100))}%`}
          </p>
          <MetricTable caption="Application funnel" values={applications.funnel} />
          {applications.reconciliation.length ? (
            <>
              <h3>Lifecycle reconciliation needed</h3>
              <ul>
                {applications.reconciliation.map((item) => (
                  <li key={item.applicationId}>
                    {item.applicationStatus} application / {item.jobStatus} job — {item.action}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>Job and application lifecycle sources agree.</p>
          )}
        </section>
      ) : null}
      {state === "ready" && interviews ? (
        <section>
          <h2>Interviews</h2>
          <p>
            {interviews.totals.completed} of {interviews.totals.stages} stages completed.
          </p>
          <MetricTable caption="Interview stage types" values={interviews.stageTypes} />
          <MetricTable
            caption="Recurring approved debrief topics"
            values={interviews.recurringTopics}
          />
          {interviews.recommendations.length ? (
            <ul>
              {interviews.recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>Approve more debrief insights to generate recommendations.</p>
          )}
        </section>
      ) : null}
      {state === "ready" && career ? (
        <section>
          <h2>Career evidence gaps</h2>
          <p>
            Based on {career.sampledRequirements} saved market requirements. “Assessment required”
            never means a skill is absent.
          </p>
          <table>
            <caption>Market demand compared with documented Career Brain evidence</caption>
            <thead>
              <tr>
                <th>Skill</th>
                <th>Demand</th>
                <th>Evidence status</th>
                <th>Recommended action</th>
              </tr>
            </thead>
            <tbody>
              {career.gaps.map((gap) => (
                <tr key={gap.skill}>
                  <th scope="row">{gap.skill}</th>
                  <td>{gap.demandCount}</td>
                  <td>{gap.status.replaceAll("_", " ")}</td>
                  <td>{gap.actions.join(" ") || "No action needed."}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </main>
  );
}
