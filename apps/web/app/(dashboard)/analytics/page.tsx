"use client";

import { useEffect, useState } from "react";

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let active = true;
    void fetch("/api/v1/analytics/portfolio")
      .then(async (response) => {
        if (!response.ok) throw new Error("analytics unavailable");
        const payload = (await response.json()) as {
          data?: { metrics?: Record<string, number> };
        };
        if (active) {
          setMetrics(payload.data?.metrics ?? {});
          setState("ready");
        }
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main>
      <h1>Analytics</h1>
      <p>Low-volume data is suppressed and every metric has a calculation version.</p>
      {state === "loading" ? <p role="status">Loading owner analytics…</p> : null}
      {state === "error" ? <p role="alert">Sign in to view private analytics.</p> : null}
      {state === "ready" ? (
        Object.keys(metrics).length ? (
          <ul>
            {Object.entries(metrics).map(([name, count]) => (
              <li key={name}>
                {name}: {count}
              </li>
            ))}
          </ul>
        ) : (
          <p>No analytics events yet.</p>
        )
      ) : null}
    </main>
  );
}
