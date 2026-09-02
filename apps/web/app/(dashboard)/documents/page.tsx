"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@career-os/database/browser";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<
    readonly { id: string; name: string; status: string }[]
  >([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
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
            document_versions?: readonly { download_status?: string }[];
          }[];
        };
        if (active) {
          setDocuments(
            (payload.data ?? []).flatMap((document) =>
              typeof document.id === "string"
                ? [
                    {
                      id: document.id,
                      name: document.name ?? "Untitled document",
                      status:
                        document.document_versions?.[0]?.download_status ??
                        document.availability ??
                        "pending"
                    }
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
              {document.name} <span>— {document.status}</span>
            </li>
          ))}
        </ul>
      ) : state === "ready" ? (
        <p>No documents yet.</p>
      ) : null}
    </main>
  );
}
