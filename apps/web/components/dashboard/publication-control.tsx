"use client";

import { useCallback, useEffect, useState } from "react";

interface Publication {
  id: string;
  version: number;
  status: "staged" | "published" | "withdrawn";
  content_hash: string;
  created_at: string;
  portfolio_items?: unknown[];
}

export function PublicationControl() {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/v1/portfolio/publications", { cache: "no-store" });
    if (!response.ok) {
      setState("error");
      return;
    }
    const payload = (await response.json()) as { data?: Publication[] };
    setPublications(payload.data ?? []);
    setState("ready");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function mutate(action: "stage" | "activate" | "rollback" | "withdraw", id?: string) {
    setBusy(true);
    setNotice(null);
    const response = await fetch(
      action === "withdraw" && id
        ? `/api/v1/portfolio/publications/${id}/withdraw`
        : "/api/v1/portfolio/publications",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `publication-${action}-${id ?? "new"}-${crypto.randomUUID()}`
        },
        body: JSON.stringify({ action, publicationId: id, confirmation: true })
      }
    );
    setBusy(false);
    setNotice(
      response.ok
        ? action === "stage"
          ? "A new evidence-safe snapshot is staged for review."
          : `Publication ${action} completed.`
        : "The publication action failed. No active snapshot was changed."
    );
    if (response.ok) await load();
  }

  return (
    <section aria-labelledby="publication-title">
      <h2 id="publication-title">Portfolio publication</h2>
      <p>
        Build an immutable preview from the Career Brain items you selected plus approved cited
        evidence. Activating it atomically replaces the current public snapshot.
      </p>
      <button disabled={busy} type="button" onClick={() => void mutate("stage")}>
        {busy ? "Working…" : "Build staged snapshot"}
      </button>
      {notice ? <p role="status">{notice}</p> : null}
      {state === "loading" ? <p role="status">Loading publication history…</p> : null}
      {state === "error" ? <p role="alert">Publication history is unavailable.</p> : null}
      {state === "ready" && publications.length ? (
        <ol className="workspace-list">
          {publications.map((publication) => (
            <li key={publication.id}>
              <h3>
                Version {publication.version} · {publication.status}
              </h3>
              <p>
                {publication.portfolio_items?.length ?? 0} projected item(s) · hash{" "}
                {publication.content_hash.slice(0, 12)}
              </p>
              <div className="workspace-actions">
                {publication.status !== "published" ? (
                  <button
                    disabled={busy}
                    type="button"
                    onClick={() =>
                      void mutate(
                        publication.status === "withdrawn" ? "rollback" : "activate",
                        publication.id
                      )
                    }
                  >
                    {publication.status === "withdrawn"
                      ? "Roll back to this version"
                      : "Activate snapshot"}
                  </button>
                ) : (
                  <button
                    disabled={busy}
                    type="button"
                    onClick={() => void mutate("withdraw", publication.id)}
                  >
                    Withdraw public snapshot
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : state === "ready" ? (
        <p>No publication has been staged. The public portfolio shows its honest empty state.</p>
      ) : null}
    </section>
  );
}
