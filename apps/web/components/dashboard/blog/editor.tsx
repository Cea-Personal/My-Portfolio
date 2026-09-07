"use client";

import { ArticleBody } from "@/components/portfolio/article-body";
import { WorkspaceToast } from "@/components/ui/workspace-toast";
import { slugifyBlogTitle } from "@/lib/blog-slug";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

interface Version {
  id: string;
  version?: number;
  title: string;
  excerpt: string;
  markdown: string;
  cover_url: string | null;
  tags: string[];
  seo_title: string | null;
  seo_description: string | null;
  evidence_ids: string[];
  created_at?: string;
}
interface Post {
  id: string;
  slug: string;
  status: string;
  scheduled_at?: string | null;
  published_at?: string | null;
  archived_at?: string | null;
  currentVersion: Version | null;
  versions?: Version[];
}
interface Fact {
  id: string;
  review_status: string;
  verified_by_owner: boolean;
  currentVersion?: { statement?: string } | null;
}

async function mutate(endpoint: string, body: unknown, method: "POST" | "PATCH" = "POST") {
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
const split = (value: FormDataEntryValue | null) =>
  typeof value === "string"
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

export function BlogEditor() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [preview, setPreview] = useState("");
  const [assistance, setAssistance] = useState("");
  const [message, setMessage] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [scheduleDraft, setScheduleDraft] = useState("");
  const load = useCallback(async () => {
    const [postResponse, factResponse] = await Promise.all([
      fetch("/api/v1/posts", { cache: "no-store" }),
      fetch("/api/v1/career/facts", { cache: "no-store" })
    ]);
    if (!postResponse.ok || !factResponse.ok) throw new Error("Could not load Blog workspace");
    const postPayload = (await postResponse.json()) as { data?: { posts?: Post[] } };
    const factPayload = (await factResponse.json()) as { data?: Fact[] };
    setPosts(postPayload.data?.posts ?? []);
    setFacts(
      (factPayload.data ?? []).filter(
        (fact) =>
          fact.verified_by_owner && ["approved", "edited_approved"].includes(fact.review_status)
      )
    );
  }, []);
  useEffect(() => {
    void load().catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : "Could not load Blog workspace");
    });
  }, [load]);
  const selected = posts.find((post) => post.id === selectedId);
  const version = selected?.currentVersion;
  useEffect(() => {
    setTitleDraft(version?.title ?? "");
    if (selected?.scheduled_at) {
      const scheduled = new Date(selected.scheduled_at);
      const local = new Date(scheduled.getTime() - scheduled.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 16);
      setScheduleDraft(local);
    } else {
      setScheduleDraft("");
    }
  }, [selected, selectedId, version?.title]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    const form = new FormData(target);
    try {
      const saved = (await mutate(
        selected ? `/api/v1/posts/${selected.id}` : "/api/v1/posts",
        {
          title: form.get("title"),
          excerpt: form.get("excerpt"),
          markdown: form.get("markdown"),
          coverUrl: form.get("coverUrl"),
          tags: split(form.get("tags")),
          seoTitle: form.get("seoTitle"),
          seoDescription: form.get("seoDescription"),
          evidenceIds: form.getAll("evidenceIds")
        },
        selected ? "PATCH" : "POST"
      )) as { post?: { id?: string } } | undefined;
      setMessage(selected ? "New immutable article version saved as draft." : "Draft created.");
      await load();
      if (!selected) {
        target.reset();
        setTitleDraft("");
        if (saved?.post?.id) setSelectedId(saved.post.id);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save article");
    }
  }

  async function action(actionName: "publish" | "archive" | "schedule") {
    if (!selected) return;
    try {
      if (actionName === "schedule") {
        if (!scheduleDraft) {
          setMessage("Choose a future publication time first.");
          return;
        }
        const scheduledAt = new Date(scheduleDraft).toISOString();
        await mutate(`/api/v1/posts/${selected.id}/schedule`, { confirmation: true, scheduledAt });
      } else {
        const confirmed = window.confirm(
          actionName === "publish"
            ? "Publish this exact reviewed version publicly?"
            : "Archive this article and remove it from the public Blog?"
        );
        if (!confirmed) return;
        await mutate(`/api/v1/posts/${selected.id}/${actionName}`, { confirmation: true });
      }
      setMessage(`Article ${actionName === "schedule" ? "scheduled" : `${actionName}ed`}.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Article action failed");
    }
  }

  async function assist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const data = (await mutate("/api/v1/posts/assist", {
        mode: form.get("mode"),
        input: form.get("input"),
        includeCareerEvidence: form.get("includeCareerEvidence") === "on",
        evidenceIds: form.getAll("evidenceIds")
      })) as { output?: string };
      setAssistance(data.output ?? "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Writing assistance failed");
    }
  }

  async function copySuggestion() {
    try {
      await navigator.clipboard.writeText(assistance);
      setMessage("Assistant suggestion copied to your clipboard.");
    } catch {
      setMessage("Clipboard access was unavailable. Select the suggestion and copy it manually.");
    }
  }

  return (
    <main className="workspace-page">
      <header className="workspace-heading">
        <p className="eyebrow">Evidence-safe publishing</p>
        <h1>Blog</h1>
        <p>
          Create, preview, version, schedule, publish, republish, and archive technical articles.
        </p>
      </header>
      <label>
        Edit an article
        <select
          value={selectedId}
          onChange={(event) => {
            setSelectedId(event.target.value);
          }}
        >
          <option value="">Create a new draft</option>
          {posts.map((post) => (
            <option key={post.id} value={post.id}>
              {post.currentVersion?.title ?? post.slug} · {post.status}
            </option>
          ))}
        </select>
      </label>
      <form
        key={selectedId || "new"}
        className="knowledge-entry-form"
        onSubmit={(event) => void save(event)}
      >
        <label>
          Title
          <input
            name="title"
            required
            value={titleDraft}
            onChange={(event) => {
              setTitleDraft(event.target.value);
            }}
          />
        </label>
        <p className="form-note">
          The shareable slug is generated automatically from the title and made URL-safe.
          <br />
          Preview: <code>{slugifyBlogTitle(titleDraft) || "post"}</code> (a numeric suffix may be
          added for duplicate titles).
          {selected?.slug ? ` Current slug: ${selected.slug}` : ""}
        </p>
        <label>
          Excerpt
          <textarea name="excerpt" defaultValue={version?.excerpt} />
        </label>
        <label>
          Markdown content
          <textarea
            name="markdown"
            required
            rows={16}
            defaultValue={version?.markdown}
            onChange={(event) => {
              setPreview(event.target.value);
            }}
          />
        </label>
        <label>
          Cover URL
          <input name="coverUrl" type="url" defaultValue={version?.cover_url ?? ""} />
        </label>
        <label>
          Tags (comma separated)
          <input name="tags" defaultValue={version?.tags.join(", ")} />
        </label>
        <label>
          SEO title
          <input name="seoTitle" defaultValue={version?.seo_title ?? ""} />
        </label>
        <label>
          SEO description
          <textarea name="seoDescription" defaultValue={version?.seo_description ?? ""} />
        </label>
        <fieldset>
          <legend>Approved evidence for professional claims</legend>
          {facts.map((fact) => (
            <label key={fact.id}>
              <input
                type="checkbox"
                name="evidenceIds"
                value={fact.id}
                defaultChecked={version?.evidence_ids.includes(fact.id)}
              />
              {fact.currentVersion?.statement ?? fact.id}
            </label>
          ))}
        </fieldset>
        <button type="submit">{selected ? "Save new version" : "Create draft"}</button>
        <button
          type="button"
          onClick={() => {
            setPreview(version?.markdown ?? "");
          }}
        >
          Preview current version
        </button>
      </form>
      {selected ? (
        <section>
          <div className="workspace-section-heading">
            <div>
              <p className="eyebrow">Article lifecycle</p>
              <h2>{selected.status === "published" ? "Published article" : "Draft controls"}</h2>
            </div>
            <strong>{selected.status}</strong>
          </div>
          <p>
            Slug: <code>/blog/{selected.slug}</code>
            {selected.published_at
              ? ` · published ${new Date(selected.published_at).toLocaleString()}`
              : ""}
          </p>
          <div className="workspace-actions">
            <label>
              Publish at
              <input
                type="datetime-local"
                value={scheduleDraft}
                onChange={(event) => {
                  setScheduleDraft(event.target.value);
                }}
              />
            </label>
            <button type="button" onClick={() => void action("schedule")}>
              Schedule
            </button>
            <button type="button" onClick={() => void action("publish")}>
              {selected.status === "published" ? "Republish current version" : "Publish"}
            </button>
            {selected.status !== "archived" ? (
              <button type="button" onClick={() => void action("archive")}>
                Archive
              </button>
            ) : null}
          </div>
          <details>
            <summary>Immutable revision history ({selected.versions?.length ?? 0})</summary>
            <ol className="blog-version-history">
              {selected.versions?.map((item) => (
                <li key={item.id}>
                  <span>
                    <strong>Version {item.version ?? "?"}</strong>: {item.title}
                    <small>
                      {item.created_at ? ` · ${new Date(item.created_at).toLocaleString()}` : ""}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      setPreview(item.markdown);
                    }}
                  >
                    Preview version
                  </button>
                </li>
              ))}
            </ol>
          </details>
        </section>
      ) : null}
      {preview ? (
        <section>
          <h2>Private preview</h2>
          <ArticleBody markdown={preview} />
        </section>
      ) : null}
      <form className="knowledge-entry-form" onSubmit={(event) => void assist(event)}>
        <h2>Optional writing assistant</h2>
        <label>
          Mode
          <select name="mode">
            {["ideas", "outline", "draft", "rewrite", "summary", "titles", "tags", "seo"].map(
              (mode) => (
                <option key={mode}>{mode}</option>
              )
            )}
          </select>
        </label>
        <label>
          Prompt or current text
          <textarea name="input" required rows={6} />
        </label>
        <label>
          <input type="checkbox" name="includeCareerEvidence" /> Include professional experience
        </label>
        <fieldset>
          <legend>Evidence available to the assistant</legend>
          {facts.map((fact) => (
            <label key={fact.id}>
              <input type="checkbox" name="evidenceIds" value={fact.id} />
              {fact.currentVersion?.statement ?? fact.id}
            </label>
          ))}
        </fieldset>
        <button type="submit">Generate bounded suggestion</button>
      </form>
      {assistance ? (
        <section>
          <div className="workspace-section-heading">
            <h2>Assistant suggestion</h2>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                void copySuggestion();
              }}
            >
              Copy suggestion
            </button>
          </div>
          <pre>{assistance}</pre>
          <p>Review and deliberately copy any useful material into the editor.</p>
        </section>
      ) : null}
      <WorkspaceToast
        message={message}
        onDismiss={() => {
          setMessage("");
        }}
      />
    </main>
  );
}
