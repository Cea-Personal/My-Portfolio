"use client";

import { useCallback, useEffect, useState } from "react";
import { ManualFreelanceImportForm } from "./manual-import-form";
import { FreelanceScoringSettings } from "./scoring-settings";

interface Opportunity {
  id: string;
  provider: string;
  budget_type: string;
  skills: string[];
  job?: { id: string; canonical_title: string; canonical_company: string; status: string; discovered_at: string } | null;
}

export function FreelanceWorkspace() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [funnel, setFunnel] = useState<{ total: number; submitted: number; won: number; lost: number; winRate: number | null } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const load = useCallback(async () => {
    setState("loading");
    try {
      const response = await fetch("/api/v1/freelance/opportunities", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as { data?: { opportunities?: Opportunity[] } };
      if (!response.ok) throw new Error("Unable to load freelance opportunities");
      setOpportunities(payload.data?.opportunities ?? []);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);
  const loadFunnel = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/freelance/analytics", { cache: "no-store" });
      const payload = await response.json() as { data?: { analytics?: typeof funnel } };
      if (response.ok && payload.data?.analytics) setFunnel(payload.data.analytics);
    } catch { /* Pipeline analytics are secondary to opportunity access. */ }
  }, []);
  useEffect(() => { void load(); void loadFunnel(); }, [load, loadFunnel]);
  return (
    <main className="workspace-page freelance-page">
      <header className="workspace-heading">
        <div><p className="eyebrow">Career OS · freelance</p><h1>Freelance opportunity workspace</h1><p>Import Upwork opportunities manually, match them to evidence, price the work, and review every proposal before submission.</p></div>
        <div className="workspace-stat"><strong>{opportunities.length}</strong><span>captured opportunities</span></div>
      </header>
      <ManualFreelanceImportForm onCreated={(id) => { window.location.assign(`/freelance/${id}`); }} />
      <FreelanceScoringSettings />
      {funnel ? <section className="workspace-card" aria-labelledby="freelance-funnel-heading"><h2 id="freelance-funnel-heading">Proposal funnel</h2><dl className="workspace-metrics"><div><dt>Tracked proposals</dt><dd>{funnel.total}</dd></div><div><dt>Submitted</dt><dd>{funnel.submitted}</dd></div><div><dt>Won</dt><dd>{funnel.won}</dd></div><div><dt>Lost</dt><dd>{funnel.lost}</dd></div><div><dt>Win rate of decided proposals</dt><dd>{funnel.winRate === null ? "Unknown" : `${Math.round(funnel.winRate * 100)}%`}</dd></div></dl></section> : null}
      <section className="workspace-card" aria-labelledby="freelance-opportunities-heading">
        <div className="workspace-section-heading"><div><p className="eyebrow">Pipeline</p><h2 id="freelance-opportunities-heading">Your opportunities</h2></div><button type="button" onClick={() => void load()}>Refresh</button></div>
        {state === "loading" ? <p role="status">Loading opportunities…</p> : null}
        {state === "error" ? <div role="alert"><p>Could not load opportunities.</p><button type="button" onClick={() => void load()}>Retry</button></div> : null}
        {state === "ready" && opportunities.length === 0 ? <p className="workspace-note">No freelance opportunities yet. Paste an Upwork listing above to start.</p> : null}
        {opportunities.length ? <ul className="workspace-list">{opportunities.map((opportunity) => <li key={opportunity.id}><a href={`/freelance/${opportunity.id}`}><strong>{opportunity.job?.canonical_title ?? "Untitled opportunity"}</strong><span>{opportunity.job?.canonical_company ?? "Upwork client"} · {opportunity.budget_type}</span><small>{opportunity.skills?.join(", ") || "Skills not recorded"}</small></a></li>)}</ul> : null}
      </section>
    </main>
  );
}
