"use client";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { WorkspaceToast } from "@/components/ui/workspace-toast";
interface Entry {
  id: string;
  title?: string | null;
  entry_date?: string | null;
  related_type?: string | null;
  journal_versions?: Array<{ id: string; version: number; text: string; created_at: string }>;
}
async function write(endpoint: string, method: "POST" | "PATCH", body: unknown) {
  const response = await fetch(endpoint, {
    method,
    headers: {
      "content-type": "application/json",
      "idempotency-key": `${method.toLowerCase()}-${crypto.randomUUID()}`,
      ...(method === "PATCH" ? { "if-match": "*" } : {})
    },
    body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => ({}))) as { data?: unknown };
  if (!response.ok) {
    const problem = payload.data as { detail?: string; code?: string } | undefined;
    throw new Error(problem?.detail ?? problem?.code ?? "Request failed");
  }
  return payload.data;
}
async function removeEntry(id: string) {
  const response = await fetch(`/api/v1/journal-entries/${id}`, {
    method: "DELETE",
    headers: { "idempotency-key": `delete-${crypto.randomUUID()}` }
  });
  const payload = (await response.json().catch(() => ({}))) as { data?: unknown };
  if (!response.ok) {
    const problem = payload.data as { detail?: string; code?: string } | undefined;
    throw new Error(problem?.detail ?? problem?.code ?? "Delete failed");
  }
}
export function JournalWorkspace() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [editingId, setEditingId] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/journal-entries", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const payload = (await response.json()) as { data?: { entries?: Entry[] } };
      setEntries(payload.data?.entries ?? []);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);
  useEffect(() => void load(), [load]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    const form = new FormData(target);
    const tags = form.get("tags");
    try {
      await write("/api/v1/journal-entries", "POST", {
        title: form.get("title"),
        text: form.get("text"),
        entryDate: form.get("entryDate"),
        relatedType: form.get("relatedType"),
        relatedId: form.get("relatedId"),
        tags:
          typeof tags === "string"
            ? tags
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean)
            : []
      });
      target.reset();
      setMessage("Journal entry saved to your private knowledge base. Indexing queued.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save entry.");
    }
  }
  async function revise(event: FormEvent<HTMLFormElement>, entry: Entry) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await write(`/api/v1/journal-entries/${entry.id}`, "PATCH", {
        title: form.get("title"),
        text: form.get("text")
      });
      setEditingId(null);
      setMessage("New journal version preserved. Knowledge-base indexing queued.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save revision.");
    }
  }
  async function remove(entry: Entry) {
    if (
      !window.confirm("Delete this journal entry? Its version history will be retained privately.")
    )
      return;
    try {
      await removeEntry(entry.id);
      if (editingId === entry.id) setEditingId(null);
      setMessage("Journal entry deleted.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete entry.");
    }
  }
  return (
    <main className="workspace-page">
      <header className="workspace-heading">
        <p className="eyebrow">Private learning record</p>
        <h1>Journal</h1>
        <p>Save private reflections directly to your knowledge base. Each version is preserved and indexed automatically.</p>
      </header>
      <section>
        <h2>New entry</h2>
        <form className="knowledge-entry-form" onSubmit={(event) => void create(event)}>
          <label>
            Title
            <input name="title" required />
          </label>
          <label>
            Date
            <input
              name="entryDate"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
          </label>
          <label>
            Related to
            <select name="relatedType">
              <option value="general">General career</option>
              <option value="job">Job</option>
              <option value="application">Application</option>
              <option value="interview">Interview</option>
              <option value="assessment">Assessment</option>
              <option value="recruiter">Recruiter interaction</option>
              <option value="rejection">Rejection</option>
              <option value="offer">Offer</option>
            </select>
          </label>
          <label>
            Related record ID (optional)
            <input name="relatedId" />
          </label>
          <label>
            Tags
            <input name="tags" placeholder="interview, system-design" />
          </label>
          <label>
            Original notes
            <textarea name="text" rows={10} required />
          </label>
          <button type="submit">Save to knowledge base</button>
        </form>
      </section>
      {state === "loading" ? <p role="status">Loading journal…</p> : null}
      {state === "error" ? <p role="alert">Could not load the private journal.</p> : null}
      {state === "ready" && !entries.length ? <p>No journal entries yet.</p> : null}
      {entries.map((entry) => {
        const latest = [...(entry.journal_versions ?? [])].sort((a, b) => b.version - a.version)[0];
        return (
          <section key={entry.id}>
            <h2>{entry.title?.trim() || "Journal entry"}</h2>
            <p>
              {entry.entry_date ?? "undated"} · {entry.related_type ?? "general"} · version{" "}
              {String(latest?.version ?? 0)}
            </p>
            <p>{latest?.text ?? "This entry has no text version yet."}</p>
            <div className="workspace-actions">
              <button
                type="button"
                onClick={() => {
                  setEditingId(editingId === entry.id ? null : entry.id);
                }}
              >
                {editingId === entry.id ? "Close editor" : "Edit entry"}
              </button>
              <button type="button" className="button-secondary" onClick={() => void remove(entry)}>
                Delete entry
              </button>
            </div>
            {editingId === entry.id ? (
              <details open>
                <summary>Edit entry (creates a new version)</summary>
                <form
                  className="knowledge-entry-form"
                  onSubmit={(event) => void revise(event, entry)}
                >
                  <label>
                    Title
                    <input name="title" defaultValue={entry.title ?? ""} />
                  </label>
                  <label>
                    Revised text
                    <textarea name="text" rows={8} defaultValue={latest?.text ?? ""} required />
                  </label>
                  <button type="submit">Save new version</button>
                </form>
              </details>
            ) : null}
            <p className="muted-copy">
              This entry is private knowledge-base material. It is available to private career
              synthesis and retrieval; nothing is published automatically.
            </p>
          </section>
        );
      })}
      <WorkspaceToast
        message={message}
        onDismiss={() => {
          setMessage("");
        }}
      />
    </main>
  );
}
