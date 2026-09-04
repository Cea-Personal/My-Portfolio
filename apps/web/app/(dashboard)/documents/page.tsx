"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@career-os/database/browser";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<
    readonly { id: string; name: string; status: string; error?: string }[]
  >([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void fetch("/api/v1/documents")
      .then(async (response) => {
        if (!response.ok) throw new Error("documents unavailable");
        const payload = (await response.json()) as {
          data?: readonly {
            id?: string;
            name?: string;
            availability?: string;
            document_versions?: readonly {
              download_status?: string;
              evidence_version_id?: string | null;
              created_at?: string;
            }[];
            ingestion_items?: readonly {
              status?: string;
              stage?: string;
              sanitized_error?: string | null;
              created_at?: string;
            }[];
          }[];
        };
        if (active) {
          setDocuments(
            (payload.data ?? []).flatMap((document) =>
              typeof document.id === "string"
                ? [
                    (() => {
                      const version = [...(document.document_versions ?? [])].sort((left, right) =>
                        String(right.created_at).localeCompare(String(left.created_at))
                      )[0];
                      const ingestion = [...(document.ingestion_items ?? [])].sort((left, right) =>
                        String(right.created_at).localeCompare(String(left.created_at))
                      )[0];
                      return {
                        id: document.id,
                        name: document.name ?? "Untitled document",
                        status: version?.evidence_version_id
                          ? "indexed"
                          : ingestion?.status === "failed"
                            ? "indexing failed"
                            : ingestion?.status === "pending" || ingestion?.status === "running"
                              ? `${ingestion.stage ?? "indexing"} · ${ingestion.status}`
                              : (version?.download_status ?? document.availability ?? "pending"),
                        ...(ingestion?.sanitized_error ? { error: ingestion.sanitized_error } : {})
                      };
                    })()
                  ]
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

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setSaving(true);
    setSaveError(null);
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
      if (!completed.ok) throw new Error("Upload could not be confirmed.");
      setDocuments((current) => [
        { id: created.documentId, name: created.filename ?? file.name, status: "uploaded" },
        ...current
      ]);
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

  return (
    <main>
      <h1>Documents</h1>
      <p>Private sources and ingestion runs.</p>
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
      </form>
      {state === "loading" ? <p role="status">Loading documents…</p> : null}
      {state === "error" ? <p role="alert">Sign in to load private documents.</p> : null}
      {state === "ready" && documents.length ? (
        <ul>
          {documents.map((document) => (
            <li key={document.id}>
              <strong>{document.name}</strong> <span>— {document.status}</span>
              {document.error ? <small>{document.error}</small> : null}
              {document.status !== "indexed" ? (
                <button
                  disabled={reprocessingId === document.id}
                  onClick={() => void reprocessDocument(document.id)}
                  type="button"
                >
                  {reprocessingId === document.id ? "Starting indexing…" : "Index knowledge"}
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
