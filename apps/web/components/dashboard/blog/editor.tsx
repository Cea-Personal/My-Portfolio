"use client";

import { ArticleBody } from "@/components/portfolio/article-body";
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
}
interface Post {
  id: string;
  slug: string;
  status: string;
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

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    const form = new FormData(target);
    try {
      await mutate(
        selected ? `/api/v1/posts/${selected.id}` : "/api/v1/posts",
        {
          title: form.get("title"),
          slug: form.get("slug"),
          excerpt: form.get("excerpt"),
          markdown: form.get("markdown"),
          coverUrl: form.get("coverUrl"),
          tags: split(form.get("tags")),
          seoTitle: form.get("seoTitle"),
          seoDescription: form.get("seoDescription"),
          evidenceIds: form.getAll("evidenceIds")
        },
        selected ? "PATCH" : "POST"
      );
      setMessage(selected ? "New immutable article version saved as draft." : "Draft created.");
      await load();
      if (!selected) target.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save article");
    }
  }

  async function action(actionName: "publish" | "archive" | "schedule") {
    if (!selected) return;
    try {
      if (actionName === "schedule") {
        const scheduledAt = window.prompt("Publication time (ISO 8601, in the future)")?.trim();
        if (!scheduledAt) return;
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
          <input name="title" required defaultValue={version?.title} />
        </label>
        <label>
          Shareable slug
          <input
            name="slug"
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            defaultValue={selected?.slug}
          />
        </label>
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
          Preview saved version
        </button>
      </form>
      {selected ? (
        <section>
          <div className="workspace-actions">
            <button type="button" onClick={() => void action("schedule")}>
              Schedule with approval
            </button>
            <button type="button" onClick={() => void action("publish")}>
              Publish / republish
            </button>
            <button type="button" onClick={() => void action("archive")}>
              Archive
            </button>
          </div>
          <details>
            <summary>Immutable revision history ({selected.versions?.length ?? 0})</summary>
            <ol>
              {selected.versions?.map((item) => (
                <li key={item.id}>
                  Version {item.version ?? "?"}: {item.title}
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
          <h2>Assistant suggestion</h2>
          <pre>{assistance}</pre>
          <p>Review and deliberately copy any useful material into the editor.</p>
        </section>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </main>
  );
}
