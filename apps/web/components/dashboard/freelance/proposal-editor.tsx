"use client";

import { useEffect, useMemo, useState } from "react";

type Claim = { text: string; evidenceIds: string[]; unsupported?: boolean; support?: string };
type EvidenceMatch = { support_class: string; evidence_handles?: { id?: string; sourceTitle?: string; sourceType?: string }[] };
type Version = { id: string; rendered_body: string; claim_refs?: Claim[]; unsupported_claims?: string[]; source: string; reviewed_at?: string | null };
type Proposal = { id: string; approval_state: string; crm_status: string; current_version_id: string | null; freelance_proposal_versions?: Version[] };

export function FreelanceProposalEditor({ proposal, evidenceMatches, onRefresh }: { proposal: Proposal; evidenceMatches: EvidenceMatch[]; onRefresh: () => void }) {
  const current = proposal.freelance_proposal_versions?.find((version) => version.id === proposal.current_version_id);
  const initialClaims = useMemo(() => current?.claim_refs ?? [], [current]);
  const [body, setBody] = useState(current?.rendered_body ?? "");
  const [claims, setClaims] = useState<Claim[]>(initialClaims);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setBody(current?.rendered_body ?? ""); setClaims(current?.claim_refs ?? []); }, [current]);
  const evidence = [...new Map(evidenceMatches.filter((match) => ["direct", "transferable", "related"].includes(match.support_class)).flatMap((match) => match.evidence_handles ?? []).filter((item) => item.id).map((item) => [item.id!, item])).values()];

  async function send(url: string, payload: Record<string, unknown> = {}) {
    setBusy(true); setError("");
    try {
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({})) as { error?: { detail?: string; code?: string } };
      if (!response.ok) throw new Error(result.error?.detail ?? result.error?.code ?? "Proposal action failed");
      onRefresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Proposal action failed"); }
    finally { setBusy(false); }
  }
  function save(markReadyForReview: boolean) {
    void send(`/api/v1/freelance/proposals/${proposal.id}/versions`, { proposalText: body, claims, markReadyForReview });
  }
  return <section className="workspace-card">
    <div className="workspace-section-heading"><div><h2>Proposal</h2><p className="workspace-note">{proposal.approval_state} · {proposal.crm_status}</p></div></div>
    {current ? <>
      <label>Proposal text<textarea value={body} onChange={(event) => setBody(event.target.value)} rows={12} maxLength={12000} /></label>
      <h3>Claims and evidence</h3>
      {claims.length ? claims.map((claim, index) => <div className="workspace-claim" key={`${index}-${claim.text.slice(0, 32)}`}>
        <label>Claim {index + 1}<textarea value={claim.text} rows={2} onChange={(event) => setClaims((all) => all.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item))} /></label>
        <label>Evidence supporting this claim<select value={claim.evidenceIds[0] ?? ""} onChange={(event) => setClaims((all) => all.map((item, itemIndex) => itemIndex === index ? { ...item, evidenceIds: event.target.value ? [event.target.value] : [], unsupported: !event.target.value } : item))}><option value="">No evidence — must remove or rewrite</option>{evidence.map((item) => <option key={item.id} value={item.id}>{item.sourceTitle ?? item.id} ({item.sourceType ?? "evidence"})</option>)}</select></label>
        {claim.evidenceIds.length ? <p className="workspace-note">Evidence ID: {claim.evidenceIds.join(", ")}</p> : <p className="workspace-error">Unsupported claim: substantiate it from Career Brain evidence or remove it.</p>}
      </div>) : <p className="workspace-note">This draft has no claim-level evidence references. Review the text carefully and add evidence-backed claims before approval.</p>}
      <button type="button" disabled={busy} onClick={() => setClaims((all) => [...all, { text: "", evidenceIds: [], unsupported: true }])}>Add an evidence-backed claim</button>
      {current.unsupported_claims?.length ? <div role="alert"><strong>Unsupported in the generated version:</strong><ul>{current.unsupported_claims.map((claim, index) => <li key={index}>{claim}</li>)}</ul></div> : null}
      <div className="workspace-actions"><button type="button" disabled={busy} onClick={() => save(false)}>Save owner-edited version</button><button type="button" disabled={busy || !claims.length || claims.some((claim) => !claim.text.trim() || !claim.evidenceIds.length)} onClick={() => save(true)}>Mark current version ready for review</button></div>
    </> : <p className="workspace-note">No proposal draft yet. Generate a draft after analyzing this opportunity.</p>}
    {proposal.approval_state === "READY_FOR_REVIEW" ? <div className="workspace-actions"><button type="button" disabled={busy} onClick={() => void send(`/api/v1/freelance/proposals/${proposal.id}/approve`)}>Approve this reviewed version</button></div> : null}
    {proposal.approval_state === "APPROVED" ? <div className="workspace-actions"><button type="button" disabled={busy} onClick={() => { if (window.confirm("Confirm that you submitted this proposal manually on Upwork? This only records the submission; it will not contact Upwork.")) void send(`/api/v1/freelance/proposals/${proposal.id}/record-submission`); }}>I submitted this manually</button></div> : null}
    {proposal.approval_state === "SUBMITTED" ? <div className="workspace-actions"><label>Update pipeline status<select value={proposal.crm_status} disabled={busy} onChange={(event) => void send(`/api/v1/freelance/proposals/${proposal.id}/transitions`, { crmStatus: event.target.value })}>{["SUBMITTED", "VIEWED", "CLIENT_RESPONDED", "INTERVIEW", "NEGOTIATION", "WON", "LOST", "WITHDRAWN"].map((status) => <option key={status}>{status}</option>)}</select></label></div> : null}
    {error ? <p role="alert" className="workspace-error">{error}</p> : null}
  </section>;
}
