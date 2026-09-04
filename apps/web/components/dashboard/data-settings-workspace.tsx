"use client";
import { useCallback, useEffect, useState } from "react";
interface ExportRow {
  id: string;
  status: string;
  format: string;
  manifest_hash: string | null;
  expires_at: string | null;
  created_at: string;
}
export function DataSettingsWorkspace() {
  const [items, setItems] = useState<ExportRow[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/v1/exports", { cache: "no-store" });
    if (!response.ok) throw new Error();
    const payload = (await response.json()) as { data?: { exports?: ExportRow[] } };
    setItems(payload.data?.exports ?? []);
  }, []);
  useEffect(() => {
    void load().catch(() => {
      setMessage("Export history could not be loaded.");
    });
  }, [load]);
  async function requestExport() {
    setBusy(true);
    try {
      const response = await fetch("/api/v1/exports", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `data-export-${crypto.randomUUID()}`
        },
        body: JSON.stringify({ format: "json" })
      });
      if (!response.ok) throw new Error();
      setMessage("Private export queued. The durable run will survive a page reload.");
      await load();
    } catch {
      setMessage("Export request failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="workspace-page">
      <header className="workspace-heading">
        <p className="eyebrow">Owner data portability</p>
        <h1>Your data</h1>
        <p>
          Build a private, time-limited JSON export with a manifest hash. Source binaries remain in
          private storage.
        </p>
      </header>
      <button type="button" disabled={busy} onClick={() => void requestExport()}>
        {busy ? "Queuing…" : "Request private export"}
      </button>
      {items.length ? (
        <table>
          <thead>
            <tr>
              <th>Requested</th>
              <th>Status</th>
              <th>Manifest</th>
              <th>Download</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.created_at).toLocaleString()}</td>
                <td>{item.status}</td>
                <td>{item.manifest_hash ?? "pending"}</td>
                <td>
                  {item.status === "completed" ? (
                    <a href={`/api/v1/exports/${item.id}/download`}>
                      Download before{" "}
                      {item.expires_at ? new Date(item.expires_at).toLocaleString() : "expiry"}
                    </a>
                  ) : (
                    "Not ready"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No export requests yet.</p>
      )}
      {message ? <p role="status">{message}</p> : null}
    </main>
  );
}
