"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@career-os/database/browser";
import { WorkspaceToast } from "@/components/ui/workspace-toast";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<
    readonly { id: string; name: string; status: string; kind?: string | undefined; error?: string }[]
  >([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [reindexingKnowledge, setReindexingKnowledge] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drive, setDrive] = useState<{
    id: string;
    status: string;
    selected_folder_id?: string | null;
    selected_folder_name?: string | null;
    last_success_at?: string | null;
    last_error_code?: string | null;
  } | null>(null);
  const [driveConfig, setDriveConfig] = useState<{
    configured: boolean;
    missing: string[];
    invalid: boolean;
    folderName?: string | null;
    serviceAccountEmail?: string | null;
  } | null>(null);
  const [driveState, setDriveState] = useState<"loading" | "ready" | "error">("loading");
  const [driveMessage, setDriveMessage] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  useEffect(() => {
    let active = true;
    const loadDocuments = () =>
      fetch("/api/v1/documents", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) {
            const problem = (await response.json().catch(() => null)) as {
              data?: { detail?: string; code?: string };
            } | null;
            if (response.status === 401) {
              window.location.assign("/sign-in?next=/settings/documents");
              return;
            }
            throw new Error(
              problem?.data?.detail ?? problem?.data?.code ?? "Documents are unavailable."
            );
          }
          const payload = (await response.json()) as {
            data?: readonly {
              id?: string;
              name?: string;
              availability?: string;
              document_kind?: string;
              document_versions?: readonly {
                download_status?: string;
                evidence_version_id?: string | null;
                created_at?: string;
              }[];
              ingestion_items?: readonly {
                status?: string;
                stage?: string;
                sanitized_error?: string | null;
                started_at?: string | null;
                finished_at?: string | null;
              }[];
            }[];
          };
          if (active) {
            setDocuments(
              (payload.data ?? []).flatMap((document) =>
                typeof document.id === "string"
                  ? [
                      (() => {
                        const version = [...(document.document_versions ?? [])].sort(
                          (left, right) =>
                            String(right.created_at).localeCompare(String(left.created_at))
                        )[0];
                        const ingestion = [...(document.ingestion_items ?? [])].sort(
                          (left, right) =>
                            (right.finished_at ?? right.started_at ?? "").localeCompare(
                              left.finished_at ?? left.started_at ?? ""
                            )
                        )[0];
                        return {
                          id: document.id,
                          name: document.name ?? "Untitled document",
                          kind: document.document_kind,
                          status: version?.evidence_version_id
                            ? "indexed"
                            : ingestion?.status === "failed"
                              ? "indexing failed"
                              : ingestion?.status === "pending" || ingestion?.status === "running"
                                ? `${ingestion.stage ?? "indexing"} · ${ingestion.status}`
                                : (version?.download_status ?? document.availability ?? "pending"),
                          ...(ingestion?.sanitized_error
                            ? { error: ingestion.sanitized_error }
                            : {})
                        };
                      })()
                    ]
                  : []
              )
            );
            setState("ready");
          }
        })
        .catch((error: unknown) => {
          if (active) {
            setLoadError(error instanceof Error ? error.message : "Documents are unavailable.");
            setState("error");
          }
        });
    void loadDocuments();
    const refresh = window.setInterval(() => void loadDocuments(), 5_000);
    return () => {
      active = false;
      window.clearInterval(refresh);
    };
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/v1/integrations/drive", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          const problem = (await response.json().catch(() => null)) as {
            data?: { detail?: string; code?: string };
          } | null;
          if (response.status === 401) {
            window.location.assign("/sign-in?next=/settings/documents");
            return;
          }
          throw new Error(
            problem?.data?.detail ?? problem?.data?.code ?? "Drive status unavailable."
          );
        }
        const payload = (await response.json()) as {
          data?: {
            connection?: typeof drive;
            configuration?: typeof driveConfig;
          };
        };
        if (active) {
          setDrive(payload.data?.connection ?? null);
          setDriveConfig(payload.data?.configuration ?? null);
          setDriveState("ready");
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setDriveMessage(error instanceof Error ? error.message : "Drive status unavailable.");
          setDriveState("error");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function activateSharedFolder() {
    setDriveMessage("Verifying the folder shared with the service account…");
    try {
      const response = await fetch("/api/v1/integrations/drive", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `drive-service-account-${crypto.randomUUID()}`
        },
        body: "{}"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        data?: {
          connection?: NonNullable<typeof drive>;
          detail?: string;
          code?: string;
        };
      };
      if (!response.ok || !payload.data?.connection)
        throw new Error(
          payload.data?.detail ?? payload.data?.code ?? "The shared folder could not be activated."
        );
      setDrive(payload.data.connection);
      setDriveMessage("Shared folder verified. This app cannot access other Drive content.");
    } catch (error) {
      setDriveMessage(
        error instanceof Error ? error.message : "Could not activate the shared Drive folder."
      );
    }
  }

  async function syncDrive() {
    if (!drive) return;
    setSyncing(true);
    setDriveMessage("Starting Drive sync…");
    try {
      const response = await fetch("/api/v1/documents/sync-runs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `drive-sync-${crypto.randomUUID()}`
        },
        body: JSON.stringify({ connectionId: drive.id, trigger: "manual" })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        data?: { detail?: string; code?: string; dispatchStatus?: string };
      };
      if (!response.ok)
        throw new Error(
          payload.data?.detail ?? payload.data?.code ?? "Drive sync could not be started."
        );
      setDriveMessage("Drive sync queued. Documents will appear here as they are indexed.");
    } catch (error) {
      setDriveMessage(error instanceof Error ? error.message : "Drive sync could not be started.");
    } finally {
      setSyncing(false);
    }
  }

  async function disconnectDrive() {
    if (
      !drive ||
      !window.confirm("Disconnect Google Drive? Existing imported documents remain private.")
    )
      return;
    const response = await fetch(`/api/v1/integrations/${encodeURIComponent(drive.id)}`, {
      method: "DELETE",
      headers: { "idempotency-key": `drive-disconnect-${crypto.randomUUID()}` }
    });
    if (!response.ok) {
      setDriveMessage("Google Drive could not be disconnected.");
      return;
    }
    setDrive(null);
    setDriveMessage("Google Drive disconnected. Imported documents were retained.");
  }

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const response = await fetch("/api/v1/documents/uploads", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `document-upload-prepare-${crypto.randomUUID()}`
        },
        body: JSON.stringify({ filename: file.name, mediaType: file.type, size: file.size })
      });
      if (!response.ok) throw new Error("Document could not be saved.");
      const payload = (await response.json()) as {
        data?: { documentId: string; filename?: string; objectKey: string; token: string };
      };
      const created = payload.data;
      if (!created) throw new Error("Document could not be saved.");
      const storage = createBrowserSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
      );
      const { error: uploadError } = await storage.storage
        .from("private-documents")
        .uploadToSignedUrl(created.objectKey, created.token, file);
      if (uploadError) throw uploadError;
      const completed = await fetch(`/api/v1/documents/uploads/${created.documentId}/complete`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `document-upload-complete-${crypto.randomUUID()}`
        },
        body: "{}"
      });
      const completion = (await completed.json().catch(() => ({}))) as {
        data?: { status?: string; detail?: string };
      };
      if (!completed.ok)
        throw new Error(completion.data?.detail ?? "Upload could not be confirmed.");
      if (completion.data?.status === "duplicate") {
        setSaveMessage(
          completion.data.detail ?? "An identical document is already in the knowledge base."
        );
      } else {
        setDocuments((current) => [
          {
            id: created.documentId,
            name: created.filename ?? file.name,
            status: "indexing · pending"
          },
          ...current
        ]);
      }
      setFile(null);
      setState("ready");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Document could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function reprocessDocument(documentId: string) {
    setReprocessingId(documentId);
    setSaveError(null);
    try {
      const response = await fetch(`/api/v1/documents/${documentId}/reprocess`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `document-reprocess-${documentId}-${crypto.randomUUID()}`
        },
        body: "{}"
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: { detail?: string };
      } | null;
      if (!response.ok)
        throw new Error(payload?.data?.detail ?? "Document indexing could not be started.");
      setDocuments((current) =>
        current.map((document) =>
          document.id === documentId ? { ...document, status: "indexing · pending" } : document
        )
      );
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Document indexing could not be started."
      );
    } finally {
      setReprocessingId(null);
    }
  }

  async function reindexKnowledge() {
    setReindexingKnowledge(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const response = await fetch("/api/v1/documents/reindex", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `knowledge-reindex-${crypto.randomUUID()}`
        },
        body: "{}"
      });
      const payload = (await response.json().catch(() => null)) as {
        data?: {
          runId?: string;
          provider?: string;
          model?: string;
          detail?: string;
          code?: string;
        };
      } | null;
      if (!response.ok || !payload?.data?.runId)
        throw new Error(
          payload?.data?.detail ?? payload?.data?.code ?? "Knowledge re-indexing could not start."
        );
      setSaveMessage(
        `Re-indexing existing knowledge with ${payload.data.provider ?? "the active provider"} / ${payload.data.model ?? "embedding model"}. Career Brain will refresh automatically.`
      );

      const deadline = Date.now() + 15 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 3_000));
        const statusResponse = await fetch(`/api/v1/ingestion-runs/${payload.data.runId}`, {
          cache: "no-store"
        });
        const statusPayload = (await statusResponse.json().catch(() => null)) as {
          data?: { status?: string; document_count?: number; error_summary?: string | null };
        } | null;
        const run = statusPayload?.data;
        if (run?.status === "completed") {
          setSaveMessage(
            `Knowledge re-indexed successfully (${String(run.document_count ?? 0)} chunks added). Career Brain refresh is queued.`
          );
          return;
        }
        if (run?.status === "failed" || run?.status === "cancelled")
          throw new Error(run.error_summary ?? "Knowledge re-indexing failed.");
      }
      setSaveMessage("Knowledge re-indexing is still running in the background.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Knowledge re-indexing could not start.");
    } finally {
      setReindexingKnowledge(false);
    }
  }

  return (
    <main>
      <h1>Documents</h1>
      <p>Private sources and ingestion runs.</p>
      <section aria-labelledby="drive-title">
        <h2 id="drive-title">Google Drive shared folder</h2>
        <p>
          This integration uses an isolated service account. It can read only folders explicitly
          shared with that account; it never requests access to your personal Drive.
        </p>
        <p>
          Later syncs import only new or changed file versions. Existing files are matched by their
          Google file ID, provider version, and content hash, so unchanged documents are not added
          again.
        </p>
        {driveState === "loading" ? <p role="status">Checking Drive connection…</p> : null}
        {driveState === "error" ? <p role="alert">{driveMessage}</p> : null}
        {driveState === "ready" && driveConfig ? (
          <div>
            <p>
              Configured folder: <strong>{driveConfig.folderName ?? "Resumes"}</strong>
            </p>
            {driveConfig.serviceAccountEmail ? (
              <p>
                Share that folder with <code>{driveConfig.serviceAccountEmail}</code> as Viewer.
              </p>
            ) : null}
            {!driveConfig.configured ? (
              <p role="alert">
                {driveConfig.invalid
                  ? "The service-account JSON or folder ID is invalid."
                  : `Missing server variables: ${driveConfig.missing.join(", ")}.`}
              </p>
            ) : null}
          </div>
        ) : null}
        {!drive && driveState === "ready" && driveConfig?.configured ? (
          <button type="button" onClick={() => void activateSharedFolder()}>
            Verify and activate shared folder
          </button>
        ) : null}
        {drive ? (
          <div>
            <p>
              Status: <strong>{drive.status}</strong>
              {drive.selected_folder_name
                ? ` · Folder: ${drive.selected_folder_name}`
                : " · No folder selected"}
            </p>
            <div className="workspace-actions">
              <button
                type="button"
                disabled={!drive.selected_folder_id || syncing}
                onClick={() => void syncDrive()}
              >
                {syncing ? "Starting sync…" : "Sync selected folder"}
              </button>
              <button type="button" onClick={() => void disconnectDrive()}>
                Disconnect
              </button>
            </div>
          </div>
        ) : null}
        {driveMessage && driveState !== "error" ? (
          <WorkspaceToast
            message={driveMessage}
            onDismiss={() => {
              setDriveMessage(null);
            }}
          />
        ) : null}
      </section>
      <form className="knowledge-entry-form" onSubmit={(event) => void uploadDocument(event)}>
        <label htmlFor="document-file">Upload a private source</label>
        <input
          accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,.md,.txt,.pdf,.docx"
          id="document-file"
          onChange={(event) => {
            setFile(event.target.files?.item(0) ?? null);
          }}
          required
          type="file"
        />
        <p>
          PDF, Word, Markdown, or text up to 50 MB. Files remain private while they are reviewed.
        </p>
        <button disabled={saving} type="submit">
          {saving ? "Uploading…" : "Upload source"}
        </button>
        {saveError ? <p role="alert">{saveError}</p> : null}
        <WorkspaceToast
          message={saveMessage}
          onDismiss={() => {
            setSaveMessage(null);
          }}
        />
      </form>
      <section aria-labelledby="knowledge-index-title">
        <h2 id="knowledge-index-title">Knowledge index</h2>
        <p>
          Re-embed existing document chunks after changing the embedding provider or model. This
          keeps the documents private and does not create duplicate files or extracted facts.
        </p>
        <button
          disabled={reindexingKnowledge}
          type="button"
          onClick={() => void reindexKnowledge()}
        >
          {reindexingKnowledge
            ? "Re-indexing existing knowledge…"
            : "Re-index all with the current embedding model"}
        </button>
      </section>
      {state === "loading" ? <p role="status">Loading documents…</p> : null}
      {state === "error" ? <p role="alert">{loadError ?? "Documents are unavailable."}</p> : null}
      {state === "ready" && documents.length ? (
        <ul>
          {documents.map((document) => (
            <li key={document.id}>
              <strong>{document.name}</strong>{" "}
              <span>
                —{" "}
                {document.kind === "cover_letter"
                  ? "Cover-letter reference"
                  : document.kind === "resume"
                    ? "CV / resume"
                    : "Other document"}{" "}
                · {document.status}
              </span>
              {document.error ? <small>{document.error}</small> : null}
              {(["uploaded", "indexing failed"].includes(document.status) ||
                document.status.startsWith("parsing") ||
                document.status.startsWith("indexing")) ? (
                <button
                  disabled={reprocessingId === document.id}
                  onClick={() => void reprocessDocument(document.id)}
                  type="button"
                >
                  {reprocessingId === document.id ? "Starting indexing…" : "Retry indexing"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : state === "ready" ? (
        <p>No documents yet.</p>
      ) : null}
    </main>
  );
}
