"use client";

import { useState } from "react";

interface Pricing { id?: string; currency: string; pricing_mode: string; estimated_hours: number; target_effective_rate: number; minimum_amount: number; recommended_amount: number; premium_amount: number; assumptions?: string[] }

export function FreelancePricingCard({ opportunityId, pricing, onSaved }: { opportunityId: string; pricing?: Pricing; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(form: FormData) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/v1/freelance/opportunities/${opportunityId}/pricing`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ pricingMode: form.get("pricingMode"), currency: form.get("currency"), estimatedHours: Number(form.get("estimatedHours")), targetEffectiveRate: Number(form.get("targetEffectiveRate")), riskBufferPercent: Number(form.get("riskBufferPercent")), assumptions: String(form.get("assumptions") ?? "").split("\n").map((line) => line.trim()).filter(Boolean) })
      });
      const payload = await response.json().catch(() => ({})) as { error?: { detail?: string } };
      if (!response.ok) throw new Error(payload.error?.detail ?? "Could not calculate pricing");
      onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not calculate pricing"); }
    finally { setBusy(false); }
  }
  return <section className="workspace-card">
    <h2>Pricing estimate</h2>
    {pricing ? <p>Latest estimate: {pricing.currency} {pricing.minimum_amount} minimum · {pricing.recommended_amount} recommended · {pricing.premium_amount} premium. Based on {pricing.estimated_hours} estimated hours at {pricing.currency} {pricing.target_effective_rate}/hour.</p> : <p className="workspace-note">No estimate yet. Enter your own effort and target rate; these are assumptions, not market data.</p>}
    <form onSubmit={(event) => { event.preventDefault(); void submit(new FormData(event.currentTarget)); }}>
      <div className="form-grid">
        <label>Pricing model<select name="pricingMode" defaultValue={pricing?.pricing_mode ?? "fixed"}><option value="fixed">Fixed</option><option value="hourly">Hourly</option><option value="milestone">Milestone</option></select></label>
        <label>Currency<input name="currency" required maxLength={12} defaultValue={pricing?.currency ?? "USD"} /></label>
        <label>Estimated hours<input name="estimatedHours" required type="number" min="0.1" step="0.1" defaultValue={pricing?.estimated_hours} /></label>
        <label>Target effective hourly rate<input name="targetEffectiveRate" required type="number" min="0.01" step="0.01" defaultValue={pricing?.target_effective_rate} /></label>
        <label>Risk buffer (%)<input name="riskBufferPercent" type="number" min="0" max="100" step="1" defaultValue="15" /></label>
        <label className="form-grid-wide">Assumptions (one per line)<textarea name="assumptions" rows={2} defaultValue={pricing?.assumptions?.join("\n")} /></label>
      </div>
      {error ? <p role="alert" className="workspace-error">{error}</p> : null}
      <div className="workspace-actions"><button type="submit" disabled={busy}>{busy ? "Calculating…" : "Save pricing estimate"}</button></div>
    </form>
  </section>;
}
