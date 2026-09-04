"use client";
import { useCallback, useEffect, useState } from "react";
interface Version {
  id: string;
  version: number;
  status: string;
  evidence_ids: string[];
  created_at: string;
}
interface Artifact {
  id: string;
  title: string;
  application_id: string;
  artifact_type: string;
  artifact_versions: Version[];
}
export function ArtifactLibrary({
  type,
  title
}: {
  type: "resume" | "cover_letter";
  title: string;
}) {
  const [items, setItems] = useState<Artifact[]>([]);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const response = await fetch(`/api/v1/artifacts?type=${type}`, { cache: "no-store" });
    if (!response.ok) throw new Error();
    const payload = (await response.json()) as { data?: Artifact[] };
    setItems(payload.data ?? []);
  }, [type]);
  useEffect(() => {
    void load().catch(() => {
      setMessage("Artifact history could not be loaded.");
    });
  }, [load]);
  async function review(version: Version, decision: "approved" | "rejected", markFinal = false) {
    const notes = window.prompt("Review note")?.trim();
    if (notes === undefined) return;
    const response = await fetch(`/api/v1/artifact-versions/${version.id}/review`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": `review-${crypto.randomUUID()}`
      },
      body: JSON.stringify({ decision, markFinal, notes })
    });
    setMessage(
      response.ok
        ? `Version ${String(version.version)} ${markFinal ? "marked final" : decision}.`
        : "Review failed; verify that evidence is linked."
    );
    if (response.ok) await load();
  }
  return (
    <main className="workspace-page">
      <header className="workspace-heading">
        <p className="eyebrow">Versioned application material</p>
        <h1>{title}</h1>
        <p>
          Create tailored drafts inside an application, then review, finalize, and download
          immutable versions here.
        </p>
        <a href="/applications">
          Open applications to compose a new {type === "resume" ? "CV" : "cover letter"}
        </a>
      </header>
      {items.length ? (
        <ul className="workspace-list">
          {items.map((item) => (
            <li key={item.id}>
              <h2>{item.title}</h2>
              <a href={`/applications/${item.application_id}`}>Application workspace</a>
              <ol>
                {[...item.artifact_versions]
                  .sort((a, b) => b.version - a.version)
                  .map((version) => (
                    <li key={version.id}>
                      Version {version.version} · {version.status} · {version.evidence_ids.length}{" "}
                      evidence link(s)
                      <div className="workspace-actions">
                        <a href={`/api/v1/artifact-versions/${version.id}/export`}>Download PDF</a>
                        <button type="button" onClick={() => void review(version, "approved")}>
                          Approve review
                        </button>
                        <button
                          type="button"
                          onClick={() => void review(version, "approved", true)}
                        >
                          Mark final
                        </button>
                        <button type="button" onClick={() => void review(version, "rejected")}>
                          Reject
                        </button>
                      </div>
                    </li>
                  ))}
              </ol>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          No {title.toLowerCase()} exist yet. Start from an eligible application so the draft
          remains bound to its job description and evidence.
        </p>
      )}
      {message ? <p role="status">{message}</p> : null}
    </main>
  );
}
