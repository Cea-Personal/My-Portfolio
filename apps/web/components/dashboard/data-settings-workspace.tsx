"use client";
import { useCallback, useEffect, useState } from "react";
import { WorkspaceToast } from "@/components/ui/workspace-toast";
interface ExportRow {
  id: string;
  status: string;
  format: string;
  manifest_hash: string | null;
  expires_at: string | null;
  error_code?: string | null;
  created_at: string;
}
export function DataSettingsWorkspace() {
  const [items, setItems] = useState<ExportRow[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const load = useCallback(async () => {
    const response = await fetch("/api/v1/exports", { cache: "no-store" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        data?: { detail?: string; code?: string };
      };
      throw new Error(
        payload.data?.detail ?? payload.data?.code ?? "Export history could not be loaded."
      );
    }
    const payload = (await response.json()) as { data?: { exports?: ExportRow[] } };
    setItems(payload.data?.exports ?? []);
  }, []);
  useEffect(() => {
    void load().catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : "Export history could not be loaded.");
    });
  }, [load]);
  const hasPendingExports = items.some(
    (item) => item.status === "queued" || item.status === "running"
  );
  useEffect(() => {
    if (!hasPendingExports) return;
    const timer = window.setInterval(() => {
      void load().catch((error: unknown) => {
        setMessage(
          error instanceof Error ? error.message : "Export status could not be refreshed."
        );
      });
    }, 4_000);
    return () => {
      window.clearInterval(timer);
    };
  }, [hasPendingExports, load]);
  async function refresh() {
    setRefreshing(true);
    try {
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export status could not be refreshed.");
    } finally {
      setRefreshing(false);
    }
  }
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
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          data?: { detail?: string; code?: string };
        };
        throw new Error(payload.data?.detail ?? payload.data?.code ?? "Export request failed.");
      }
      setMessage("Private export queued. The durable run will survive a page reload.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export request failed.");
    } finally {
      setBusy(false);
    }
  }
  async function retryExport(id: string) {
    setRetryingId(id);
    try {
      const response = await fetch(`/api/v1/exports/${id}/retry`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `export-retry-${id}-${crypto.randomUUID()}`
        },
        body: "{}"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        data?: { detail?: string; code?: string };
      };
      if (!response.ok)
        throw new Error(payload.data?.detail ?? payload.data?.code ?? "Export retry failed.");
      setMessage("Export requeued. The worker will process it automatically.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export retry failed.");
    } finally {
      setRetryingId(null);
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
      <button type="button" disabled={refreshing} onClick={() => void refresh()}>
        {refreshing ? "Refreshing…" : "Refresh status"}
      </button>
      {hasPendingExports ? (
        <p className="data-export-status-note">
          Export processing is still in progress. This page checks for completion automatically.
        </p>
      ) : null}
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
                <td>
                  {item.status === "queued"
                    ? "Queued"
                    : item.status === "running"
                      ? "Preparing"
                      : item.status === "completed"
                        ? "Ready"
                        : item.status === "failed"
                          ? "Failed"
                          : item.status}
                  {item.error_code ? (
                    <small className="data-export-error">{item.error_code}</small>
                  ) : null}
                </td>
                <td>{item.manifest_hash ?? "pending"}</td>
                <td>
                  {item.status === "completed" ? (
                    <a href={`/api/v1/exports/${item.id}/download`}>
                      Download before{" "}
                      {item.expires_at ? new Date(item.expires_at).toLocaleString() : "expiry"}
                    </a>
                  ) : item.status === "queued" ? (
                    <>
                      Waiting for export worker{" "}
                      <button
                        type="button"
                        className="button-secondary"
                        disabled={retryingId === item.id}
                        onClick={() => void retryExport(item.id)}
                      >
                        {retryingId === item.id ? "Retrying…" : "Retry"}
                      </button>
                    </>
                  ) : item.status === "running" ? (
                    "Building private export…"
                  ) : item.status === "failed" ? (
                    <>
                      Export failed
                      {item.error_code ? `: ${item.error_code}` : ". See Settings → Logs."}{" "}
                      <button
                        type="button"
                        className="button-secondary"
                        disabled={retryingId === item.id}
                        onClick={() => void retryExport(item.id)}
                      >
                        {retryingId === item.id ? "Retrying…" : "Retry"}
                      </button>
                    </>
                  ) : item.status === "expired" ? (
                    "Expired — request a new export"
                  ) : (
                    "Unavailable"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No export requests yet.</p>
      )}
      <WorkspaceToast
        message={message}
        onDismiss={() => {
          setMessage("");
        }}
      />
    </main>
  );
}
