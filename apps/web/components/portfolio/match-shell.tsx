"use client";

import { useState } from "react";

export function RoleFit() {
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<{ score: string; abstained?: boolean } | null>(null);
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
      const payload = (await response.json()) as { data?: { score?: string; abstained?: boolean } };
      if (!response.ok) throw new Error("request failed");
      setResult({
        score: payload.data?.score ?? "0.0000",
        ...(typeof payload.data?.abstained === "boolean"
          ? { abstained: payload.data.abstained }
          : {})
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
        <p>Share a role description to explore the approved evidence behind the fit.</p>
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
          <p>
            Match score: {result.score}
            {result.abstained ? " (no approved evidence matched)" : ""}
          </p>
        ) : null}
      </div>
    </details>
  );
}

export const MatchShell = RoleFit;
