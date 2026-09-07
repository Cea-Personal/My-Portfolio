"use client";

import { useState } from "react";

export function RoleFit() {
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<{
    score: string;
    abstained?: boolean;
    unavailable?: boolean;
    requirements: readonly {
      id: string;
      text?: string;
      priority: string;
      outcome?: string;
      rationale?: string;
      evidence?: string[];
    }[];
  } | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function match() {
    if (!description.trim()) return;
    setLoading(true);
    setError(false);
    try {
      const response = await fetch("/api/v1/public/jd-matches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description })
      });
      const payload = (await response.json()) as {
        data?: {
          score?: string;
          abstained?: boolean;
          unavailable?: boolean;
          requirements?: readonly {
            id: string;
            text?: string;
            priority: string;
            outcome?: string;
            rationale?: string;
            evidence?: string[];
          }[];
        };
      };
      if (!response.ok) throw new Error("request failed");
      setResult({
        score: payload.data?.score ?? "0.0000",
        requirements: payload.data?.requirements ?? [],
        ...(typeof payload.data?.abstained === "boolean"
          ? { abstained: payload.data.abstained }
          : {}),
        ...(payload.data?.unavailable === true ? { unavailable: true } : {})
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <details className="assistant-role-fit" id="match">
      <summary>
        <span>
          <small>Role fit</small>
          <strong>How do I fit?</strong>
        </span>
        <i aria-hidden="true">+</i>
      </summary>
      <div className="assistant-role-fit-body" aria-live="polite">
        <p>Share a role description to see how it fits with the facts in this portfolio.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void match();
          }}
        >
          <label htmlFor="role-description">Role description</label>
          <textarea
            id="role-description"
            value={description}
            maxLength={50000}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
            rows={6}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Comparing…" : "Compare"}
          </button>
        </form>
        {error ? <p role="alert">Matching is unavailable. Try again.</p> : null}
        {result ? (
          <div className="role-fit-results">
            {result.unavailable ? (
              <p className="assistant-unavailable" role="status">
                Portfolio facts are reconnecting. Role fit will be available when the published
                portfolio data is reachable.
              </p>
            ) : null}
            <p>
              Match score: {result.score}
              {result.abstained ? " (no matching portfolio facts)" : ""}
            </p>
            {result.requirements.length ? (
              <div className="role-fit-table-wrap">
                <table>
                  <caption>Requirement-by-requirement fit</caption>
                  <thead>
                    <tr>
                      <th>Requirement</th>
                      <th>Priority</th>
                      <th>Outcome</th>
                      <th>Relevant facts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.requirements.map((requirement) => (
                      <tr key={requirement.id}>
                        <th scope="row">{requirement.text ?? "Requirement"}</th>
                        <td>{requirement.priority}</td>
                        <td>
                          {requirement.outcome?.replace("_", " ") ?? "not assessed"}
                          <small>{requirement.rationale}</small>
                        </td>
                        <td>
                          {requirement.evidence?.length
                            ? requirement.evidence.join(", ")
                            : "No supporting facts"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>There were no distinct requirements to compare.</p>
            )}
            <small>
              Scores summarize the portfolio facts only; they are not a hiring prediction.
            </small>
          </div>
        ) : null}
      </div>
    </details>
  );
}

export const MatchShell = RoleFit;
