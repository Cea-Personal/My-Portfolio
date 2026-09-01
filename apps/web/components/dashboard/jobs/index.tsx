"use client";

import { useEffect, useState } from "react";

export function JobsWorkspace() {
  const [jobs, setJobs] = useState<readonly { id: string; title: string; company: string }[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let active = true;
    void fetch("/api/v1/jobs")
      .then(async (response) => {
        if (!response.ok) throw new Error("jobs unavailable");
        const payload = (await response.json()) as {
          data?: { jobs?: readonly Record<string, unknown>[] };
        };
        if (active) {
          setJobs(
            (payload.data?.jobs ?? []).flatMap((job) => {
              const id = typeof job.id === "string" ? job.id : "";
              const title = typeof job.canonical_title === "string" ? job.canonical_title : "Role";
              const company =
                typeof job.canonical_company === "string" ? job.canonical_company : "Company";
              return id ? [{ id, title, company }] : [];
            })
          );
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
      <h1>Opportunities</h1>
      <p>Review discovered, interested, applied, and archived roles.</p>
      {state === "loading" ? <p role="status">Loading opportunities…</p> : null}
      {state === "error" ? <p role="alert">Sign in to load private opportunities.</p> : null}
      {state === "ready" && jobs.length ? (
        <ul>
          {jobs.map((job) => (
            <li key={job.id}>
              {job.title} — {job.company}
            </li>
          ))}
        </ul>
      ) : state === "ready" ? (
        <p>No opportunities yet.</p>
      ) : null}
    </main>
  );
}
