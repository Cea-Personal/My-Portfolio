"use client";

import { useCallback, useEffect, useState } from "react";
import { PublicationControl } from "../publication-control";

interface CareerFact {
  id: string;
  factType: string;
  statement: string;
  visibility: string;
  reviewStatus: string;
  projectionEligible: boolean;
  structuredValue: Record<string, unknown>;
}

interface ExtractedCandidate {
  id: string;
  statement: string;
  confidence: number | null;
  factType: string;
  sourceOffsets: Record<string, unknown>;
}

const FACT_TYPES = [
  "experience",
  "responsibility",
  "achievement",
  "project",
  "skill",
  "education",
  "certification"
];

export function CareerBrain() {
  const [facts, setFacts] = useState<CareerFact[]>([]);
  const [candidates, setCandidates] = useState<ExtractedCandidate[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [statement, setStatement] = useState("");
  const [factType, setFactType] = useState("achievement");
  const [context, setContext] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const [factsResponse, candidatesResponse] = await Promise.all([
        fetch("/api/v1/career/facts", { cache: "no-store" }),
        fetch("/api/v1/fact-reviews", { cache: "no-store" })
      ]);
      if (!factsResponse.ok || !candidatesResponse.ok) throw new Error("CAREER_BRAIN_UNAVAILABLE");
      const factsPayload = (await factsResponse.json()) as { data?: Record<string, unknown>[] };
      const candidatesPayload = (await candidatesResponse.json()) as {
        data?: Record<string, unknown>[];
      };
      setFacts(
        (factsPayload.data ?? []).map((fact) => {
          const version =
            fact.currentVersion && typeof fact.currentVersion === "object"
              ? (fact.currentVersion as Record<string, unknown>)
              : {};
          return {
            id: String(fact.id),
            factType: typeof fact.fact_type === "string" ? fact.fact_type : "fact",
            statement: typeof version.statement === "string" ? version.statement : "Untitled fact",
            visibility: typeof fact.visibility === "string" ? fact.visibility : "private",
            reviewStatus: typeof fact.review_status === "string" ? fact.review_status : "candidate",
            projectionEligible: fact.projectionEligible === true,
            structuredValue:
              version.structured_value && typeof version.structured_value === "object"
                ? (version.structured_value as Record<string, unknown>)
                : {}
          };
        })
      );
      setCandidates(
        (candidatesPayload.data ?? []).map((candidate) => {
          const subject =
            candidate.subject_candidate && typeof candidate.subject_candidate === "object"
              ? (candidate.subject_candidate as Record<string, unknown>)
              : {};
          return {
            id: String(candidate.id),
            statement:
              typeof candidate.statement === "string" ? candidate.statement : "Untitled candidate",
            confidence: typeof candidate.confidence === "number" ? candidate.confidence : null,
            factType: typeof subject.factType === "string" ? subject.factType : "responsibility",
            sourceOffsets:
              candidate.source_offsets && typeof candidate.source_offsets === "object"
                ? (candidate.source_offsets as Record<string, unknown>)
                : {}
          };
        })
      );
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addFact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!statement.trim()) return;
    setSaving(true);
    setNotice(null);
    const response = await fetch("/api/v1/career/facts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": `manual-fact-${crypto.randomUUID()}`
      },
      body: JSON.stringify({
        statement,
        factType,
        subjectType: "career",
        visibility: "private",
        structuredValue: context.trim() ? { context: context.trim() } : {}
      })
    });
    setSaving(false);
    if (!response.ok) {
      setNotice("The fact could not be saved. Check the fields and try again.");
      return;
    }
    setStatement("");
    setContext("");
    setNotice("Private fact saved. Review it before making it public.");
    await load();
  }

  async function reviewCandidate(
    candidate: ExtractedCandidate,
    decision: "approve" | "edit" | "reject" | "defer"
  ) {
    setNotice(null);
    const response = await fetch("/api/v1/fact-reviews", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": `fact-review-${candidate.id}-${crypto.randomUUID()}`
      },
      body: JSON.stringify({
        extractedFactId: candidate.id,
        decision,
        statement: candidate.statement,
        structuredValue: { factType: candidate.factType },
        visibility: "private"
      })
    });
    if (!response.ok) {
      setNotice("The review decision could not be saved.");
      return;
    }
    setNotice(`Candidate ${decision === "defer" ? "deferred" : `${decision}d`}.`);
    await load();
  }

  async function updateFact(fact: CareerFact, visibility: "private" | "public") {
    const response = await fetch(`/api/v1/career/facts/${fact.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "idempotency-key": `fact-${fact.id}-${crypto.randomUUID()}`
      },
      body: JSON.stringify({
        visibility,
        reviewStatus: "approved",
        verifiedByOwner: true
      })
    });
    setNotice(response.ok ? "Fact visibility and approval saved." : "Fact update failed.");
    if (response.ok) await load();
  }

  return (
    <section className="workspace-page" aria-labelledby="career-brain-title">
      <header className="workspace-heading">
        <p className="eyebrow">Trusted knowledge</p>
        <h1 id="career-brain-title">Career Brain</h1>
        <p>
          Capture structured facts, review document suggestions, and choose what can be published.
        </p>
      </header>

      <form className="knowledge-entry-form" onSubmit={(event) => void addFact(event)}>
        <h2>Add a private fact</h2>
        <label htmlFor="knowledge-type">Fact type</label>
        <select
          id="knowledge-type"
          value={factType}
          onChange={(event) => {
            setFactType(event.target.value);
          }}
        >
          {FACT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <label htmlFor="knowledge-statement">Statement</label>
        <textarea
          id="knowledge-statement"
          onChange={(event) => {
            setStatement(event.target.value);
          }}
          placeholder="What did you build, improve, learn, or deliver?"
          required
          rows={4}
          value={statement}
        />
        <label htmlFor="knowledge-context">Structured context</label>
        <input
          id="knowledge-context"
          onChange={(event) => {
            setContext(event.target.value);
          }}
          placeholder="Role, project, company, timeframe, or measurable context"
          value={context}
        />
        <button disabled={saving} type="submit">
          {saving ? "Saving…" : "Save private fact"}
        </button>
      </form>

      {notice ? <p role="status">{notice}</p> : null}
      {state === "loading" ? <p role="status">Loading trusted knowledge…</p> : null}
      {state === "error" ? <p role="alert">Career Brain could not be loaded.</p> : null}

      {state === "ready" ? (
        <div className="career-brain-columns">
          <section aria-labelledby="candidate-title">
            <h2 id="candidate-title">Review extracted evidence</h2>
            <p>{candidates.length} document suggestion(s) need an owner decision.</p>
            {candidates.length ? (
              <ul className="workspace-list">
                {candidates.map((candidate) => (
                  <li key={candidate.id}>
                    <p className="eyebrow">{candidate.factType}</p>
                    <p>{candidate.statement}</p>
                    <small>
                      Confidence:{" "}
                      {candidate.confidence === null
                        ? "not supplied"
                        : `${String(Math.round(candidate.confidence * 100))}%`}{" "}
                      · Source offsets: {JSON.stringify(candidate.sourceOffsets)}
                    </small>
                    <div className="workspace-actions" aria-label={`Review ${candidate.statement}`}>
                      <button
                        type="button"
                        onClick={() => void reviewCandidate(candidate, "approve")}
                      >
                        Approve
                      </button>
                      <button type="button" onClick={() => void reviewCandidate(candidate, "edit")}>
                        Approve edited
                      </button>
                      <button
                        type="button"
                        onClick={() => void reviewCandidate(candidate, "defer")}
                      >
                        Defer
                      </button>
                      <button
                        type="button"
                        onClick={() => void reviewCandidate(candidate, "reject")}
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No extracted facts are waiting for review.</p>
            )}
          </section>

          <section aria-labelledby="canonical-title">
            <h2 id="canonical-title">Canonical facts</h2>
            <p>Only owner-approved public facts become eligible for a future publication.</p>
            {facts.length ? (
              <ul className="workspace-list">
                {facts.map((fact) => (
                  <li key={fact.id}>
                    <p className="eyebrow">{fact.factType}</p>
                    <h3>{fact.statement}</h3>
                    {Object.keys(fact.structuredValue).length ? (
                      <pre>{JSON.stringify(fact.structuredValue, null, 2)}</pre>
                    ) : null}
                    <p>
                      {fact.reviewStatus} · {fact.visibility} ·{" "}
                      {fact.projectionEligible
                        ? "eligible for projection"
                        : "not projection eligible"}
                    </p>
                    <div className="workspace-actions">
                      <button type="button" onClick={() => void updateFact(fact, "public")}>
                        Approve for publication
                      </button>
                      <button type="button" onClick={() => void updateFact(fact, "private")}>
                        Keep private
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No canonical facts yet. Add one or approve a document suggestion.</p>
            )}
          </section>
        </div>
      ) : null}
      <PublicationControl />
    </section>
  );
}
