"use client";

import { useEffect, useState } from "react";

const labels: Record<string, string> = { technicalFit: "Technical fit", evidenceStrength: "Evidence strength", budgetEconomics: "Budget / economics", winProbability: "Win probability", clientQuality: "Client quality", strategicValue: "Strategic value", scopeClarity: "Scope clarity", deliveryRisk: "Delivery risk" };

export function FreelanceScoringSettings() {
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void fetch("/api/v1/freelance/settings/scoring", { cache: "no-store" }).then(async (response) => { const payload = await response.json() as { data?: { weights?: Record<string, number> } }; if (response.ok && payload.data?.weights) setWeights(payload.data.weights); }).catch(() => setMessage("Could not load score weights.")); }, []);
  const total = Object.values(weights).reduce((sum, value) => sum + (Number(value) || 0), 0);
  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/v1/freelance/settings/scoring", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ weights }) });
      const payload = await response.json().catch(() => ({})) as { error?: { detail?: string } };
      if (!response.ok) throw new Error(payload.error?.detail ?? "Unable to save scoring weights");
      setMessage("Scoring weights saved. New score snapshots will use them; existing snapshots remain unchanged.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save scoring weights"); }
    finally { setBusy(false); }
  }
  return <details className="workspace-card"><summary>Configure opportunity score weights ({total || "…"}/100)</summary>
    <p className="workspace-note">Weights apply to new score snapshots only. Unknown factors are excluded from the calculated score and reported separately.</p>
    <div className="form-grid">{Object.entries(labels).map(([key, label]) => <label key={key}>{label} (%)<input type="number" min="0" max="100" step="1" value={weights[key] ?? ""} onChange={(event) => setWeights((current) => ({ ...current, [key]: Number(event.target.value) }))} /></label>)}</div>
    {Math.abs(total - 100) > 1e-8 ? <p role="status">Weights must total 100; currently {total}.</p> : null}
    {message ? <p role="status">{message}</p> : null}
    <button type="button" disabled={busy || Math.abs(total - 100) > 1e-8} onClick={() => void save()}>{busy ? "Saving…" : "Save weights"}</button>
  </details>;
}
