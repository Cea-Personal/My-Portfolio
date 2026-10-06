"use client";

import { useCallback, useEffect, useState } from "react";
import { FreelancePricingCard } from "@/components/dashboard/freelance/pricing-card";
import { FreelanceProposalEditor } from "@/components/dashboard/freelance/proposal-editor";

interface DetailProps { opportunityId: string }

const scoreRows = [
  ["Technical fit", "technical_fit", "technicalFit"],
  ["Evidence strength", "evidence_strength", "evidenceStrength"],
  ["Budget/economics", "budget_economics", "budgetEconomics"],
  ["Win probability", "win_probability", "winProbability"],
  ["Client quality", "client_quality", "clientQuality"],
  ["Strategic value", "strategic_value", "strategicValue"],
  ["Scope clarity", "scope_clarity", "scopeClarity"],
  ["Delivery risk", "delivery_risk", "deliveryRisk"]
] as const;

export function FreelanceDetail({ opportunityId }: DetailProps) {
  const [data, setData] = useState<any>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    setState("loading");
    try {
      const response = await fetch(`/api/v1/freelance/opportunities/${opportunityId}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as { data?: { opportunity?: unknown } };
      if (!response.ok || !payload.data?.opportunity) throw new Error("Opportunity not found");
      setData(payload.data.opportunity);
      setState("ready");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load opportunity"); setState("error"); }
  }, [opportunityId]);
  useEffect(() => { void load(); }, [load]);
  async function action(path: string, body: Record<string, unknown> = {}) {
    setMessage("");
    const response = await fetch(`/api/v1/freelance/opportunities/${opportunityId}/${path}`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(body) });
    const payload = (await response.json().catch(() => ({}))) as { data?: unknown; error?: { detail?: string; code?: string } };
    if (!response.ok) throw new Error(payload.error?.detail ?? payload.error?.code ?? "Action failed");
    await load();
  }
  if (state === "loading") return <main className="workspace-page"><p role="status">Loading opportunity…</p></main>;
  if (state === "error") return <main className="workspace-page"><div role="alert"><p>{message}</p><button type="button" onClick={() => void load()}>Retry</button></div></main>;
  const job = data.job ?? {};
  const score = data.scores?.[0];
  const analysis = data.analyses?.[0];
  const proposal = data.proposal;
  return <main className="workspace-page freelance-detail-page">
    <p><a href="/freelance">← Back to freelance workspace</a></p>
    <header className="workspace-heading"><div><p className="eyebrow">{data.provider} · {data.import_mode}</p><h1>{job.canonical_title}</h1><p>{job.canonical_company}</p></div>{score ? <div className="workspace-stat"><strong>{score.total_score}</strong><span>{score.recommendation}</span></div> : null}</header>
    {message ? <p role="status" className="workspace-note">{message}</p> : null}
    <section className="workspace-card"><div className="workspace-section-heading"><h2>Opportunity</h2><span>{data.budget_type} · {data.currency ?? "currency unknown"}</span></div><p>{job.current_description}</p><p className="workspace-note">Skills: {data.skills?.join(", ") || "not recorded"}</p><div className="workspace-actions"><button type="button" onClick={() => void action("analyze").catch((error) => setMessage(error.message))}>Analyze opportunity</button><button type="button" onClick={() => void action("score").catch((error) => setMessage(error.message))}>Calculate score</button><button type="button" onClick={() => void action("proposal").catch((error) => setMessage(error.message))}>Draft proposal</button></div></section>
    {analysis ? <section className="workspace-card"><h2>Analysis</h2><p>{analysis.problem_summary ?? "Client need not yet summarized."}</p>
      <h3>Listing requirements</h3>{Array.isArray(analysis.observed?.listingRequirements) && analysis.observed.listingRequirements.length ? <ul>{analysis.observed.listingRequirements.map((item: { text?: string; priority?: string; sourceQuote?: string }, index: number) => <li key={index}><strong>{item.text}</strong> ({item.priority}){item.sourceQuote ? <blockquote>{item.sourceQuote}</blockquote> : null}</li>)}</ul> : <p className="workspace-note">No requirements were verified with exact listing excerpts.</p>}
      <h3>Deliverables</h3>{Array.isArray(analysis.deliverables) && analysis.deliverables.length ? <ul>{analysis.deliverables.map((item: { text?: string; sourceQuote?: string }, index: number) => <li key={index}>{item.text}{item.sourceQuote ? <blockquote>{item.sourceQuote}</blockquote> : null}</li>)}</ul> : <p className="workspace-note">No deliverables were verified.</p>}
      <p><strong>Complexity:</strong> {analysis.complexity?.level ?? "unknown"} — {analysis.complexity?.rationale ?? "No evidence-backed estimate."}</p>
      {Array.isArray(analysis.risks) && analysis.risks.length ? <><h3>Inferred risks</h3><ul>{analysis.risks.map((item: { text?: string; rationale?: string; sourceQuote?: string }, index: number) => <li key={index}>{item.text}: {item.rationale}{item.sourceQuote ? <blockquote>{item.sourceQuote}</blockquote> : null}</li>)}</ul></> : null}
      {Array.isArray(analysis.inferred?.items) && analysis.inferred.items.length ? <><h3>Inferences</h3><ul>{analysis.inferred.items.map((item: { text?: string; rationale?: string; sourceQuote?: string }, index: number) => <li key={index}>{item.text}: {item.rationale}{item.sourceQuote ? <blockquote>{item.sourceQuote}</blockquote> : null}</li>)}</ul></> : null}
      <p><strong>Unknown:</strong> {Array.isArray(analysis.unknown) ? analysis.unknown.join(" · ") : "Not recorded"}</p>
    </section> : null}
    {data.evidenceMatches?.length ? <section className="workspace-card"><h2>Career Brain evidence matches</h2><ul>{data.evidenceMatches.map((match: { id: string; requirement_text: string; support_class: string; reason: string; evidence_handles?: { id: string; sourceTitle?: string }[] }) => <li key={match.id}><strong>{match.requirement_text}</strong> — {match.support_class}<p>{match.reason}</p>{match.evidence_handles?.length ? <ul>{match.evidence_handles.map((handle) => <li key={handle.id}>{handle.sourceTitle ?? "Career evidence"} · {handle.id}</li>)}</ul> : <p className="workspace-note">No supporting evidence retrieved. This is not a claim that the skill is absent.</p>}</li>)}</ul></section> : null}
    {score ? <section className="workspace-card"><h2>Score breakdown</h2><p>Known-factor score: {score.total_score}/100 · {Math.round(Number(score.evidence_coverage) * 100)}% factor coverage. Missing factors are excluded, not guessed. Recommendation: {score.recommendation}.</p><dl className="workspace-metrics">{scoreRows.map(([label, key, factor]) => <div key={key}><dt>{label} · {score.weights?.[factor] ?? "?"}%</dt><dd>{score[key] == null ? "Unknown" : `${score[key]}/100`}</dd></div>)}</dl><p className="workspace-note">Unknown: {(score.unknown_factors ?? []).join(", ") || "none"} · Calculation: {score.calculation_version}</p></section> : null}
    <section className="workspace-card"><h2>Evidence gaps</h2>{data.evidenceGaps?.length ? <ul>{data.evidenceGaps.map((gap: { id: string; requirement_text: string; smallest_improvement: string }) => <li key={gap.id}><strong>{gap.requirement_text}</strong><br />{gap.smallest_improvement}</li>)}</ul> : <p className="workspace-note">Run analysis to identify evidence gaps.</p>}</section>
    <FreelancePricingCard opportunityId={opportunityId} pricing={data.pricing?.[0]} onSaved={() => void load()} />
    {proposal ? <FreelanceProposalEditor proposal={proposal} evidenceMatches={data.evidenceMatches ?? []} onRefresh={() => void load()} /> : null}
  </main>;
}
