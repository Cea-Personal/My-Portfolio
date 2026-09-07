"use client";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { WorkspaceToast } from "@/components/ui/workspace-toast";
interface Insight {
  id: string;
  text: string;
  kind?: string | null;
  status: string;
}
interface Entry {
  id: string;
  title?: string | null;
  entry_date: string;
  related_type?: string | null;
  journal_versions?: Array<{ id: string; version: number; text: string; created_at: string }>;
  journal_insights?: Insight[];
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
export function JournalWorkspace() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
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
    const form = new FormData(event.currentTarget);
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
      event.currentTarget.reset();
      setMessage("Original journal entry preserved as version 1.");
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
      setMessage("New journal version preserved; the original remains unchanged.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save revision.");
    }
  }
  async function derive(entry: Entry) {
    try {
      await write(`/api/v1/journal-entries/${entry.id}/insight-runs`, "POST", {});
      setMessage("Candidate insights created separately from your original text.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not derive insights.");
    }
  }
  async function review(insight: Insight, decision: "approved" | "rejected") {
    try {
      await write(`/api/v1/journal-insights/${insight.id}/review`, "POST", { decision });
      setMessage(`Insight ${decision}.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not review insight.");
    }
  }
  return (
    <main className="workspace-page">
      <header className="workspace-heading">
        <p className="eyebrow">Private learning record</p>
        <h1>Journal</h1>
        <p>Keep original reflections immutable and review derived learning separately.</p>
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
          <button type="submit">Save immutable entry</button>
        </form>
      </section>
      {state === "loading" ? <p role="status">Loading journal…</p> : null}
      {state === "error" ? <p role="alert">Could not load the private journal.</p> : null}
      {state === "ready" && !entries.length ? <p>No journal entries yet.</p> : null}
      {entries.map((entry) => {
        const latest = [...(entry.journal_versions ?? [])].sort((a, b) => b.version - a.version)[0];
        return (
          <section key={entry.id}>
            <h2>{entry.title ?? "Journal entry"}</h2>
            <p>
              {entry.entry_date} · {entry.related_type ?? "general"} · version{" "}
              {String(latest?.version ?? 0)}
            </p>
            <p>{latest?.text}</p>
            <details>
              <summary>Revise without overwriting</summary>
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
            <div className="workspace-actions">
              <button type="button" onClick={() => void derive(entry)}>
                Derive candidate insights
              </button>
            </div>
            {entry.journal_insights?.length ? (
              <ul className="workspace-list">
                {entry.journal_insights.map((insight) => (
                  <li key={insight.id}>
                    <strong>{insight.kind ?? "theme"}</strong> · {insight.status}
                    <p>{insight.text}</p>
                    {insight.status === "candidate" ? (
                      <div className="workspace-actions">
                        <button type="button" onClick={() => void review(insight, "approved")}>
                          Approve
                        </button>
                        <button type="button" onClick={() => void review(insight, "rejected")}>
                          Reject
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No derived insights.</p>
            )}
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
