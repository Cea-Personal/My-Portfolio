"use client";

import { useEffect, useState } from "react";

interface ApplicationDetailProps {
  id: string;
}

interface DetailState {
  application: Record<string, unknown> | null;
  artifacts: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  packages: Record<string, unknown>[];
}

function display(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function arrayData(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> => !!item && typeof item === "object"
  );
}

export function ApplicationDetail({ id }: ApplicationDetailProps) {
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let active = true;
    void Promise.all(
      ["", "/artifacts", "/documents", "/packages"].map(async (suffix) => {
        const response = await fetch(`/api/v1/applications/${encodeURIComponent(id)}${suffix}`, {
          cache: "no-store"
        });
        if (!response.ok) throw new Error("application unavailable");
        return (await response.json()) as { data?: unknown };
      })
    )
      .then(([application, artifacts, documents, packages]) => {
        if (!active) return;
        const row = application?.data;
        setDetail({
          application: row && typeof row === "object" ? (row as Record<string, unknown>) : null,
          artifacts: arrayData(artifacts?.data),
          documents: arrayData(documents?.data),
          packages: arrayData(packages?.data)
        });
        setState("ready");
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (state === "loading")
    return (
      <main>
        <p role="status">Loading application workspace…</p>
      </main>
    );
  if (state === "error")
    return (
      <main>
        <p role="alert">Sign in to load this application workspace.</p>
      </main>
    );
  if (!detail?.application)
    return (
      <main>
        <p>No application found.</p>
      </main>
    );
  const application = detail.application;
  return (
    <main>
      <h1>Application {id}</h1>
      <p>Status: {display(application.status, "draft")}</p>
      <p>Application workspace data is private, versioned, and never submitted automatically.</p>
      <section aria-labelledby="application-artifacts">
        <h2 id="application-artifacts">Artifacts</h2>
        {detail.artifacts.length ? (
          <ul>
            {detail.artifacts.map((item, index) => (
              <li key={display(item.id, String(index))}>
                {display(item.title, display(item.artifact_type, "Artifact"))}
              </li>
            ))}
          </ul>
        ) : (
          <p>No artifacts yet.</p>
        )}
      </section>
      <section aria-labelledby="application-documents">
        <h2 id="application-documents">Documents</h2>
        {detail.documents.length ? (
          <ul>
            {detail.documents.map((item, index) => (
              <li key={display(item.id, String(index))}>
                {display(item.original_filename, display(item.document_kind, "Document"))} ·{" "}
                {display(item.availability, "available")}
              </li>
            ))}
          </ul>
        ) : (
          <p>No source documents yet.</p>
        )}
      </section>
      <section aria-labelledby="application-packages">
        <h2 id="application-packages">Packages</h2>
        {detail.packages.length ? (
          <ul>
            {detail.packages.map((item, index) => (
              <li key={display(item.id, String(index))}>
                Version {display(item.version, String(index + 1))} · {display(item.status, "draft")}
              </li>
            ))}
          </ul>
        ) : (
          <p>No application packages yet.</p>
        )}
      </section>
    </main>
  );
}
