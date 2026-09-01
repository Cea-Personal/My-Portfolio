"use client";

import { useEffect, useState } from "react";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<readonly { id: string; name: string }[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let active = true;
    void fetch("/api/v1/documents")
      .then(async (response) => {
        if (!response.ok) throw new Error("documents unavailable");
        const payload = (await response.json()) as {
          data?: readonly { id?: string; name?: string }[];
        };
        if (active) {
          setDocuments(
            (payload.data ?? []).flatMap((document) =>
              typeof document.id === "string"
                ? [{ id: document.id, name: document.name ?? "Untitled document" }]
                : []
            )
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
      <h1>Documents</h1>
      <p>Private sources and ingestion runs.</p>
      {state === "loading" ? <p role="status">Loading documents…</p> : null}
      {state === "error" ? <p role="alert">Sign in to load private documents.</p> : null}
      {state === "ready" && documents.length ? (
        <ul>
          {documents.map((document) => (
            <li key={document.id}>{document.name}</li>
          ))}
        </ul>
      ) : state === "ready" ? (
        <p>No documents yet.</p>
      ) : null}
    </main>
  );
}
