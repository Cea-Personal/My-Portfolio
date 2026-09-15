"use client";

import { useState } from "react";
import type { PublicRoleFitResult } from "@/lib/server/public-role-fit";

export function RoleFit() {
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<(PublicRoleFitResult & { unavailable?: boolean }) | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function match() {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/v1/public/jd-matches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description })
      });
      const payload = (await response.json()) as {
        data?: PublicRoleFitResult & { unavailable?: boolean; detail?: string };
      };
      if (!response.ok || !payload.data || !Array.isArray(payload.data.matches))
        throw new Error(
          payload.data?.detail || "The comparison could not be completed. Please try again."
        );
      setResult(payload.data);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The comparison could not be completed. Please try again."
      );
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
        <p>
          Share a job description to compare its main requirements with my experience, projects and
          skills.
        </p>
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
            disabled={loading}
            maxLength={50000}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
            rows={6}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Finding areas of fit…" : "See how I fit"}
          </button>
        </form>
        {error ? <p role="alert">{error}</p> : null}
        {result ? (
          <div className="role-fit-results">
            {result.unavailable ? (
              <p className="assistant-unavailable" role="status">
                Portfolio facts are reconnecting. Role fit will be available when the published
                portfolio data is reachable.
              </p>
            ) : null}
            {!result.unavailable ? (
              <div className="role-fit-answer">
                {result.summary
                  .split(/\n\s*\n/)
                  .filter((paragraph) => paragraph.trim())
                  .map((paragraph, index) => (
                    <p key={index}>{paragraph.trim()}</p>
                  ))}
              </div>
            ) : null}
            {result.matches?.length ? (
              <div className="role-fit-comparison">
                <p id="role-fit-score-guide" className="role-fit-score-guide">
                  Scores reflect the information available, not a hiring probability. 100: direct
                  match · 75: strong match · 50: partial match · 25: transferable experience · 0:
                  not established.
                </p>
                <table className="role-fit-matrix" aria-describedby="role-fit-score-guide">
                  <caption>How my experience aligns with this role</caption>
                  <thead>
                    <tr>
                      <th scope="col">Major requirement</th>
                      <th scope="col">Match score</th>
                      <th scope="col">How my experience fits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.matches.map((match) => (
                      <tr key={match.area}>
                        <th scope="row" data-label="Major requirement">
                          <span>{match.area}</span>
                          <details>
                            <summary>From the job description</summary>
                            <ul>
                              {match.requirements.map((text) => (
                                <li key={text}>{text}</li>
                              ))}
                            </ul>
                          </details>
                        </th>
                        <td data-label="Match score">
                          <span className="role-fit-score" data-score={match.score}>
                            {match.score}
                            <small>/100</small>
                          </span>
                          <span className="role-fit-score-label">
                            {match.score === 100
                              ? "Direct match"
                              : match.score === 75
                                ? "Strong match"
                                : match.score === 50
                                  ? "Partial match"
                                  : match.score === 25
                                    ? "Transferable"
                                    : "Not established"}
                          </span>
                        </td>
                        <td data-label="How my experience fits">
                          <p>{match.explanation}</p>
                          {match.sources.length ? (
                            <details>
                              <summary>Supporting experience</summary>
                              <p>
                                {[...new Set(match.sources.map((source) => source.title))].join(
                                  " · "
                                )}
                              </p>
                            </details>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </details>
  );
}

export const MatchShell = RoleFit;
