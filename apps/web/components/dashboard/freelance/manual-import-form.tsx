"use client";

import { useState } from "react";

export function ManualFreelanceImportForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(formData: FormData) {
    setBusy(true);
    setError("");
    const body = {
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      url: String(formData.get("url") ?? "") || undefined,
      clientName: String(formData.get("clientName") ?? "") || undefined,
      budgetType: String(formData.get("budgetType") ?? "unknown"),
      budgetMin: formData.get("budgetMin") ? Number(formData.get("budgetMin")) : undefined,
      budgetMax: formData.get("budgetMax") ? Number(formData.get("budgetMax")) : undefined,
      hourlyMin: formData.get("hourlyMin") ? Number(formData.get("hourlyMin")) : undefined,
      hourlyMax: formData.get("hourlyMax") ? Number(formData.get("hourlyMax")) : undefined,
      currency: String(formData.get("currency") ?? "") || undefined,
      duration: String(formData.get("duration") ?? "") || undefined,
      skills: String(formData.get("skills") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
      ownerNotes: String(formData.get("ownerNotes") ?? "") || undefined
    };
    try {
      const response = await fetch("/api/v1/freelance/opportunities", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify(body)
      });
      const payload = (await response.json().catch(() => ({}))) as { data?: { opportunity?: { id?: string } }; error?: { detail?: string } };
      if (!response.ok || !payload.data?.opportunity?.id) throw new Error(payload.error?.detail ?? "Unable to import opportunity");
      onCreated(payload.data.opportunity.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to import opportunity");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="workspace-card"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(new FormData(event.currentTarget));
      }}
    >
      <div className="workspace-section-heading">
        <div>
          <p className="eyebrow">Manual Upwork import</p>
          <h2>Capture an opportunity</h2>
        </div>
        <span className="workspace-note">No API connection required</span>
      </div>
      <div className="form-grid">
        <label>Title<input name="title" required maxLength={240} /></label>
        <label>Client<input name="clientName" maxLength={240} /></label>
        <label className="form-grid-wide">Upwork URL<input name="url" type="url" placeholder="https://www.upwork.com/jobs/..." /></label>
        <label className="form-grid-wide">Description<textarea name="description" required rows={8} maxLength={100000} /></label>
        <label>Budget type<select name="budgetType" defaultValue="unknown"><option value="unknown">Unknown</option><option value="hourly">Hourly</option><option value="fixed">Fixed</option><option value="milestone">Milestone</option></select></label>
        <label>Currency<input name="currency" placeholder="USD" maxLength={12} /></label>
        <label>Budget min<input name="budgetMin" type="number" min="0" step="0.01" /></label>
        <label>Budget max<input name="budgetMax" type="number" min="0" step="0.01" /></label>
        <label>Hourly min<input name="hourlyMin" type="number" min="0" step="0.01" /></label>
        <label>Hourly max<input name="hourlyMax" type="number" min="0" step="0.01" /></label>
        <label>Expected duration<input name="duration" placeholder="2–4 weeks" /></label>
        <label>Skills<input name="skills" placeholder="TypeScript, PostgreSQL" /></label>
        <label className="form-grid-wide">Owner notes<textarea name="ownerNotes" rows={3} maxLength={10000} /></label>
      </div>
      {error ? <p role="alert" className="workspace-error">{error}</p> : null}
      <div className="workspace-actions"><button type="submit" disabled={busy}>{busy ? "Importing…" : "Import opportunity"}</button></div>
    </form>
  );
}
