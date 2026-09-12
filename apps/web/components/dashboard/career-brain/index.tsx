"use client";

import { useCallback, useEffect, useState } from "react";
import { CAREER_FACT_TYPES } from "@/lib/career-fact-taxonomy";
import { expandTechnologyLabels, expandTechnologyTerms } from "@/lib/portfolio-career-rules";
import type { CareerBrainContent, CareerBrainItem } from "@/lib/server/career-brain-synthesis";
import { WorkspaceToast } from "@/components/ui/workspace-toast";
import { PublicationControl } from "../publication-control";

interface Snapshot {
  id: string;
  content: CareerBrainContent;
  focus_jobs: unknown[];
  provider: string | null;
  model: string | null;
  generated_at: string;
}

interface Selection {
  item_key: string;
  item_type: string;
  public_eligible: boolean;
}

interface ProjectMedia {
  id: string;
  project_key: string;
  source_type: "uploaded" | "ai_generated";
  status: "draft" | "approved" | "rejected" | "superseded";
  public_url: string;
  alt_text: string;
  provider?: string | null;
  model?: string | null;
  created_at: string;
}

const value = (item: CareerBrainItem, key: string) =>
  typeof item[key] === "string" ? item[key] : "";
const list = (item: CareerBrainItem, key: string) =>
  Array.isArray(item[key])
    ? item[key].filter((entry): entry is string => typeof entry === "string")
    : [];
const displayValue = (item: CareerBrainItem, key: string) =>
  expandTechnologyTerms(value(item, key));
const displayList = (item: CareerBrainItem, key: string) =>
  list(item, key).map(expandTechnologyTerms);
const objectList = (item: CareerBrainItem, key: string): CareerBrainItem[] =>
  Array.isArray(item[key])
    ? item[key].filter(
        (entry): entry is CareerBrainItem => Boolean(entry) && typeof entry === "object"
      )
    : [];
const externalHref = (value: string) => (/^https?:\/\//i.test(value.trim()) ? value.trim() : "");

function PublishChoice({
  itemKey,
  itemType,
  selected,
  busy,
  onChange
}: {
  itemKey: string;
  itemType: string;
  selected: boolean;
  busy: boolean;
  onChange: (itemKey: string, itemType: string, selected: boolean) => Promise<void>;
}) {
  return (
    <button
      className={selected ? "career-publish-choice is-selected" : "career-publish-choice"}
      disabled={busy}
      type="button"
      onClick={() => void onChange(itemKey, itemType, !selected)}
    >
      {selected ? "Selected for public portfolio" : "Keep private · select to publish"}
    </button>
  );
}

export function CareerBrain() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [generating, setGenerating] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statement, setStatement] = useState("");
  const [factType, setFactType] = useState<(typeof CAREER_FACT_TYPES)[number]>("experience");
  const [organization, setOrganization] = useState("");
  const [role, setRole] = useState("");
  const [period, setPeriod] = useState("");
  const [saving, setSaving] = useState(false);
  const [projectMedia, setProjectMedia] = useState<Record<string, ProjectMedia[]>>({});
  const [projectImageDirection, setProjectImageDirection] = useState<Record<string, string>>({});
  const [projectImageReferences, setProjectImageReferences] = useState<Record<string, File[]>>({});

  const applyPayload = useCallback(
    (payload: { snapshot?: Snapshot | null; selections?: Selection[] }) => {
      setSnapshot(payload.snapshot ?? null);
      setSelections(payload.selections ?? []);
      setState("ready");
    },
    []
  );

  const regenerate = useCallback(
    async (quiet = false, mode: "resynthesize" | "refresh" = "resynthesize") => {
      setGenerating(true);
      if (!quiet) setNotice(null);
      const response = await fetch("/api/v1/career/brain", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `career-brain-${crypto.randomUUID()}`
        },
        body: JSON.stringify({ mode })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        data?: {
          snapshot?: Snapshot | null;
          selections?: Selection[];
          detail?: string;
          code?: string;
        };
      };
      setGenerating(false);
      if (!response.ok) {
        setNotice(
          payload.data?.detail ?? payload.data?.code ?? "Career Brain could not be generated."
        );
        setState((current) => (current === "loading" ? "error" : current));
        return;
      }
      applyPayload(payload.data ?? {});
      if (!quiet) setNotice("Career Brain regenerated from the latest career information.");
    },
    [applyPayload]
  );

  useEffect(() => {
    let active = true;
    void fetch("/api/v1/career/brain", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const payload = (await response.json()) as {
          data?: { snapshot?: Snapshot | null; selections?: Selection[] };
        };
        if (!active) return;
        applyPayload(payload.data ?? {});
        // Do not start a second synthesis when a snapshot already exists. A manual
        // refresh is explicit; automatically racing it can make one request hit the
        // snapshot uniqueness constraint after the other request has succeeded.
        if (!payload.data?.snapshot) void regenerate(true);
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, [applyPayload, regenerate]);

  const selected = (key: string) =>
    selections.some((item) => item.item_key === key && item.public_eligible);

  async function selectForPortfolio(itemKey: string, itemType: string, publicEligible: boolean) {
    setBusyKey(itemKey);
    const response = await fetch("/api/v1/career/brain/selections", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": `career-selection-${itemKey}-${crypto.randomUUID()}`
      },
      body: JSON.stringify({ itemKey, itemType, publicEligible })
    });
    setBusyKey(null);
    if (!response.ok) {
      setNotice("The portfolio selection could not be saved.");
      return;
    }
    setSelections((current) => [
      ...current.filter((item) => item.item_key !== itemKey),
      { item_key: itemKey, item_type: itemType, public_eligible: publicEligible }
    ]);
    setNotice(
      publicEligible
        ? "Selected. It will appear after you build and activate a portfolio snapshot."
        : "The item remains private and will be excluded from the next portfolio snapshot."
    );
  }

  async function addFact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const response = await fetch("/api/v1/career/facts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": `manual-fact-${crypto.randomUUID()}`
      },
      body: JSON.stringify({
        statement,
        factType,
        visibility: "private",
        structuredValue: factType === "experience" ? { organization, role, period } : {}
      })
    });
    setSaving(false);
    if (!response.ok) {
      setNotice("The private source could not be saved.");
      return;
    }
    setStatement("");
    setOrganization("");
    setRole("");
    setPeriod("");
    setNotice("Private source saved. Updating Career Brain…");
    await regenerate(true);
  }

  const content = snapshot?.content;
  useEffect(() => {
    const projects = content?.projects ?? [];
    if (!projects.length) {
      setProjectMedia({});
      return;
    }
    let active = true;
    void Promise.all(
      projects.map(async (project) => {
        try {
          const response = await fetch(
            `/api/v1/portfolio/projects/${encodeURIComponent(project.id)}/media`,
            { cache: "no-store" }
          );
          if (!response.ok) return [project.id, []] as const;
          const payload = (await response.json().catch(() => ({}))) as {
            data?: { media?: ProjectMedia[] };
          };
          return [project.id, payload.data?.media ?? []] as const;
        } catch {
          // Media is optional enrichment. A storage or media endpoint outage
          // must never prevent the synthesized career details from rendering.
          return [project.id, []] as const;
        }
      })
    ).then((entries) => {
      if (active) {
        setProjectMedia(Object.fromEntries(entries) as Record<string, ProjectMedia[]>);
      }
    });
    return () => {
      active = false;
    };
  }, [content]);

  async function refreshProjectMedia(projectKey: string) {
    try {
      const response = await fetch(
        `/api/v1/portfolio/projects/${encodeURIComponent(projectKey)}/media`,
        { cache: "no-store" }
      );
      if (!response.ok) return false;
      const payload = (await response.json()) as { data?: { media?: ProjectMedia[] } };
      setProjectMedia((current) => ({ ...current, [projectKey]: payload.data?.media ?? [] }));
      return true;
    } catch {
      return false;
    }
  }

  async function generateProjectCover(item: CareerBrainItem) {
    const busy = `media:${item.id}`;
    setBusyKey(busy);
    try {
      const body = new FormData();
      const direction = projectImageDirection[item.id]?.trim();
      if (direction) body.set("direction", direction);
      for (const reference of projectImageReferences[item.id] ?? []) {
        body.append("referenceImages", reference);
      }
      const response = await fetch(
        `/api/v1/portfolio/projects/${encodeURIComponent(item.id)}/media/generate`,
        {
          method: "POST",
          headers: { "idempotency-key": `project-cover-${item.id}-${crypto.randomUUID()}` },
          body
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        data?: { detail?: string; code?: string };
      };
      if (!response.ok)
        throw new Error(payload.data?.detail ?? payload.data?.code ?? "Image generation failed.");
      const mediaLoaded = await refreshProjectMedia(item.id);
      setNotice(
        mediaLoaded
          ? "Cover generated as a private draft. Approve it when you are happy with it."
          : "Cover generated, but the media preview is temporarily unavailable. Career details remain available."
      );
      setProjectImageReferences((current) => ({ ...current, [item.id]: [] }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Image generation failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function uploadProjectCover(item: CareerBrainItem, file: File) {
    const busy = `media:${item.id}`;
    setBusyKey(busy);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("altText", `${value(item, "title")} project cover`);
      const response = await fetch(
        `/api/v1/portfolio/projects/${encodeURIComponent(item.id)}/media`,
        {
          method: "POST",
          headers: { "idempotency-key": `project-upload-${item.id}-${crypto.randomUUID()}` },
          body
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        data?: { detail?: string; code?: string };
      };
      if (!response.ok)
        throw new Error(payload.data?.detail ?? payload.data?.code ?? "Image upload failed.");
      const mediaLoaded = await refreshProjectMedia(item.id);
      setNotice(
        mediaLoaded
          ? "Image uploaded as a private draft. Approve it to use it in the portfolio."
          : "Image uploaded, but the media preview is temporarily unavailable."
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function approveProjectCover(item: CareerBrainItem, mediaId: string) {
    const busy = `media:${item.id}`;
    setBusyKey(busy);
    try {
      const response = await fetch(
        `/api/v1/portfolio/projects/${encodeURIComponent(item.id)}/media/${mediaId}/approve`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": `project-approve-${mediaId}-${crypto.randomUUID()}`
          },
          body: JSON.stringify({})
        }
      );
      if (!response.ok) throw new Error("The project image could not be approved.");
      const mediaLoaded = await refreshProjectMedia(item.id);
      setNotice(
        mediaLoaded
          ? "Project cover approved and now visible on the public portfolio."
          : "Project cover approved and queued for the public portfolio, but the media preview is temporarily unavailable."
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "The project image could not be approved."
      );
    } finally {
      setBusyKey(null);
    }
  }
  const technicalSkills = content
    ? Array.from(new Map(content.technicalSkills.map((item) => [item.id, item])).values())
    : [];
  const projectCategories = [
    "Software",
    "AI software engineering",
    "Data platform",
    "Data engineering",
    "AI engineering",
    "AI data engineering"
  ];
  const projectGroups = content
    ? projectCategories
        .map((category) => ({
          category,
          items: content.projects.filter((item) => value(item, "category") === category)
        }))
        .filter((group) => group.items.length)
    : [];
  const profileStats = content
    ? [
        { label: "Roles", value: content.experiences.length },
        { label: "Projects", value: content.projects.length },
        { label: "Credentials", value: content.education.length + content.certifications.length },
        { label: "Skill groups", value: technicalSkills.length },
        { label: "Selected", value: selections.filter((item) => item.public_eligible).length }
      ]
    : [];
  return (
    <main className="workspace-page career-brain" aria-labelledby="career-brain-title">
      <header className="workspace-heading career-brain-heading">
        <p className="eyebrow">Private, evolving career intelligence</p>
        <h1 id="career-brain-title">Career Brain</h1>
        <p>
          One living profile synthesized from uploaded files, Google Drive, journals, manual facts,
          and the jobs you have recently pursued. Nothing becomes public until you select it and
          activate a portfolio snapshot.
        </p>
        <div className="career-brain-actions">
          <button disabled={generating} type="button" onClick={() => void regenerate()}>
            {generating ? "Re-synthesizing Career Brain…" : "Re-synthesize Career Brain"}
          </button>
          <button
            className="button-secondary"
            disabled={generating}
            type="button"
            onClick={() => void regenerate(false, "refresh")}
          >
            Refresh cached profile
          </button>
        </div>
        {snapshot ? (
          <small>
            Last generated {new Date(snapshot.generated_at).toLocaleString()} · {snapshot.provider}{" "}
            / {snapshot.model}
            {snapshot.focus_jobs.length
              ? ` · informed by ${String(snapshot.focus_jobs.length)} recent application(s)`
              : ""}
          </small>
        ) : null}
      </header>

      <nav className="career-brain-index" aria-label="Career Brain sections">
        <a href="#career-profiles">Profiles</a>
        <a href="#career-experiences">Experience</a>
        <a href="#career-projects">Projects</a>
        <a href="#career-credentials">Credentials</a>
        <a href="#career-skills">Skills</a>
        <a href="#career-add-source">Add source</a>
      </nav>

      <WorkspaceToast
        message={notice}
        onDismiss={() => {
          setNotice(null);
        }}
      />
      {state === "loading" ? <p role="status">Loading your private career profile…</p> : null}
      {state === "error" && !snapshot ? (
        <p role="alert">
          Career Brain is not available yet. Check the AI provider message above and try refresh.
        </p>
      ) : null}

      {content ? (
        <section className="career-brain-overview" aria-label="Career Brain overview">
          <div>
            <p className="eyebrow">Current profile</p>
            <h2>A living view of your work.</h2>
            <p>
              Review the synthesized profile below, then choose the parts that should move into the
              next public portfolio snapshot.
            </p>
          </div>
          <dl>
            {profileStats.map((stat) => (
              <div key={stat.label}>
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {content ? (
        <div className="career-synthesis">
          <section
            id="career-profiles"
            className="career-narratives"
            aria-labelledby="career-narratives-title"
          >
            <header>
              <p className="eyebrow">Profiles</p>
              <h2 id="career-narratives-title">Your story, shaped for its destination.</h2>
            </header>
            <article>
              <h3>CV profile summary</h3>
              <p>
                {expandTechnologyTerms(content.cvSummary) ||
                  "More career detail is needed to form a CV summary."}
              </p>
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard.writeText(expandTechnologyTerms(content.cvSummary))
                }
              >
                Copy CV summary
              </button>
            </article>
            <article>
              <h3>Portfolio profile summary</h3>
              <p>
                {expandTechnologyTerms(content.portfolioSummary) ||
                  "More career detail is needed to form a portfolio summary."}
              </p>
              <PublishChoice
                itemKey="profile:portfolio"
                itemType="portfolio_summary"
                selected={selected("profile:portfolio")}
                busy={busyKey === "profile:portfolio"}
                onChange={selectForPortfolio}
              />
            </article>
            <article>
              <h3>About me</h3>
              <p>
                {expandTechnologyTerms(content.about) ||
                  "More career detail is needed to form an About narrative."}
              </p>
              <PublishChoice
                itemKey="profile:about"
                itemType="about"
                selected={selected("profile:about")}
                busy={busyKey === "profile:about"}
                onChange={selectForPortfolio}
              />
            </article>
          </section>

          <section id="career-experiences" aria-labelledby="career-experiences-title">
            <header>
              <p className="eyebrow">Experience</p>
              <h2 id="career-experiences-title">Roles, organisations, and the work within them.</h2>
              <p>
                Repeated CV entries for the same role are merged. For each role, Career Brain keeps
                up to 10 detailed, de-duplicated experience sentences that combine responsibilities,
                achievements, impacts, and outcomes, ranked against your recent target job
                descriptions.
              </p>
            </header>
            <div className="career-synthesis-list">
              {content.experiences.map((item, itemIndex) => (
                <details key={`${item.id}-${String(itemIndex)}`}>
                  <summary>
                    <span>
                      <strong>{displayValue(item, "role")}</strong>
                      <small>
                        {displayValue(item, "organization")} · {displayValue(item, "period")}
                      </small>
                    </span>
                    <em>{displayValue(item, "summary")}</em>
                  </summary>
                  <div className="career-synthesis-detail">
                    {list(item, "experience").length ? (
                      <section>
                        <h3>Experience</h3>
                        <ul>
                          {displayList(item, "experience").map((entry, entryIndex) => (
                            <li key={`${entry}-${String(entryIndex)}`}>{entry}</li>
                          ))}
                        </ul>
                      </section>
                    ) : null}
                    {objectList(item, "workProjects").length ? (
                      <section>
                        <h3>Projects carried out in this role</h3>
                        <div className="career-role-projects">
                          {objectList(item, "workProjects").map((project, projectIndex) => (
                            <article key={`${value(project, "title")}-${String(projectIndex)}`}>
                              <h4>{displayValue(project, "title")}</h4>
                              <p>{displayValue(project, "summary")}</p>
                              {value(project, "outcome") ? (
                                <p>
                                  <strong>Outcome:</strong> {displayValue(project, "outcome")}
                                </p>
                              ) : null}
                              {list(project, "technologies").length ? (
                                <small>
                                  {expandTechnologyLabels(list(project, "technologies")).join(
                                    " · "
                                  )}
                                </small>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      </section>
                    ) : list(item, "projects").length ? (
                      <section>
                        <h3>Projects carried out in this role</h3>
                        <ul>
                          {list(item, "projects").map((entry, entryIndex) => (
                            <li key={`${entry}-${String(entryIndex)}`}>{entry}</li>
                          ))}
                        </ul>
                      </section>
                    ) : null}
                    {list(item, "technologies").length ? (
                      <p>
                        <strong>Technical skills:</strong>{" "}
                        {expandTechnologyLabels(list(item, "technologies")).join(", ")}
                      </p>
                    ) : null}
                    {list(item, "evidence").length ? (
                      <details>
                        <summary>Source details</summary>
                        <ul>
                          {list(item, "evidence").map((entry, entryIndex) => (
                            <li key={`${entry}-${String(entryIndex)}`}>{entry}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                    <PublishChoice
                      itemKey={item.id}
                      itemType="experience"
                      selected={selected(item.id)}
                      busy={busyKey === item.id}
                      onChange={selectForPortfolio}
                    />
                  </div>
                </details>
              ))}
            </div>
          </section>

          <section id="career-projects" aria-labelledby="career-projects-title">
            <header>
              <p className="eyebrow">Selected projects</p>
              <h2 id="career-projects-title">Systems and ideas with a story behind them.</h2>
            </header>
            <div className="career-editorial-grid">
              {projectGroups.map((group) => (
                <section key={group.category} className="career-project-group">
                  <h3>{group.category}</h3>
                  {group.items.map((item, itemIndex) => (
                    <article key={`${item.id}-${String(itemIndex)}`}>
                      <h4>{displayValue(item, "title")}</h4>
                      {value(item, "role") ? <small>{displayValue(item, "role")}</small> : null}
                      <p>{displayValue(item, "summary")}</p>
                      {value(item, "outcome") ? (
                        <p>
                          <strong>Outcome:</strong> {displayValue(item, "outcome")}
                        </p>
                      ) : null}
                      {list(item, "process").length ? (
                        <div>
                          <strong>How it was built</strong>
                          <ul>
                            {displayList(item, "process").map((entry, entryIndex) => (
                              <li key={`${entry}-${String(entryIndex)}`}>{entry}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      <small>
                        {expandTechnologyLabels(list(item, "technologies")).join(" · ")}
                      </small>
                      {externalHref(value(item, "githubUrl")) ||
                      externalHref(value(item, "videoUrl")) ||
                      externalHref(value(item, "liveUrl")) ? (
                        <p className="career-project-links">
                          {externalHref(value(item, "githubUrl")) ? (
                            <a
                              href={externalHref(value(item, "githubUrl"))}
                              target="_blank"
                              rel="noreferrer"
                            >
                              GitHub ↗
                            </a>
                          ) : null}
                          {externalHref(value(item, "videoUrl")) ? (
                            <a
                              href={externalHref(value(item, "videoUrl"))}
                              target="_blank"
                              rel="noreferrer"
                            >
                              YouTube ↗
                            </a>
                          ) : null}
                          {externalHref(value(item, "liveUrl")) ? (
                            <a
                              href={externalHref(value(item, "liveUrl"))}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Live project ↗
                            </a>
                          ) : null}
                        </p>
                      ) : null}
                      {(() => {
                        const media = projectMedia[item.id] ?? [];
                        const approved = media.find((asset) => asset.status === "approved");
                        const drafts = media.filter((asset) => asset.status === "draft");
                        const mediaBusy = busyKey === `media:${item.id}`;
                        const references = projectImageReferences[item.id] ?? [];
                        return (
                          <section
                            className="career-project-media"
                            aria-label="Project cover image"
                          >
                            {approved ? (
                              <img
                                src={approved.public_url}
                                alt={approved.alt_text || `${value(item, "title")} project cover`}
                                loading="lazy"
                              />
                            ) : (
                              <p>No approved cover image yet.</p>
                            )}
                            <label>
                              Optional art direction
                              <textarea
                                value={projectImageDirection[item.id] ?? ""}
                                onChange={(event) => {
                                  setProjectImageDirection((current) => ({
                                    ...current,
                                    [item.id]: event.target.value
                                  }));
                                }}
                                placeholder="For example: use a quiet editorial composition with a visible data-flow motif and deep teal accents."
                                rows={2}
                                maxLength={1200}
                              />
                            </label>
                            <label>
                              Optional reference images
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                multiple
                                disabled={mediaBusy}
                                onChange={(event) => {
                                  const files = Array.from(event.target.files ?? []).slice(0, 4);
                                  event.target.value = "";
                                  setProjectImageReferences((current) => ({
                                    ...current,
                                    [item.id]: files
                                  }));
                                }}
                              />
                              <small>
                                Up to 4 JPEG, PNG, or WebP files; used as visual references, not
                                copied.
                              </small>
                            </label>
                            {references.length ? (
                              <small>
                                References: {references.map((file) => file.name).join(" · ")}
                              </small>
                            ) : null}
                            <div className="workspace-actions">
                              <button
                                type="button"
                                disabled={mediaBusy}
                                onClick={() => void generateProjectCover(item)}
                              >
                                {mediaBusy
                                  ? "Working…"
                                  : approved
                                    ? "Regenerate cover"
                                    : "Generate cover"}
                              </button>
                              <label className="button-secondary">
                                Upload cover
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  hidden
                                  disabled={mediaBusy}
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    event.target.value = "";
                                    if (file) void uploadProjectCover(item, file);
                                  }}
                                />
                              </label>
                            </div>
                            {drafts.map((asset) => (
                              <div key={asset.id} className="career-project-media-draft">
                                <img
                                  src={asset.public_url}
                                  alt={asset.alt_text || `${value(item, "title")} generated draft`}
                                  loading="lazy"
                                />
                                <span>
                                  {asset.source_type === "ai_generated"
                                    ? `Generated${asset.model ? ` with ${asset.model}` : ""}`
                                    : "Uploaded draft"}
                                </span>
                                <button
                                  type="button"
                                  disabled={mediaBusy}
                                  onClick={() => void approveProjectCover(item, asset.id)}
                                >
                                  Approve this cover
                                </button>
                              </div>
                            ))}
                          </section>
                        );
                      })()}
                      {list(item, "evidence").length ? (
                        <details>
                          <summary>Source details</summary>
                          <ul>
                            {list(item, "evidence").map((entry, entryIndex) => (
                              <li key={`${entry}-${String(entryIndex)}`}>{entry}</li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                      <PublishChoice
                        itemKey={item.id}
                        itemType="project"
                        selected={selected(item.id)}
                        busy={busyKey === item.id}
                        onChange={selectForPortfolio}
                      />
                    </article>
                  ))}
                </section>
              ))}
            </div>
          </section>

          <section
            id="career-credentials"
            className="career-credentials"
            aria-labelledby="career-credentials-title"
          >
            <header>
              <p className="eyebrow">Credentials</p>
              <h2 id="career-credentials-title">Education and certifications</h2>
            </header>
            <div className="career-lined-list">
              {content.education.map((item, itemIndex) => (
                <article key={`${item.id}-${String(itemIndex)}`}>
                  <div>
                    <h3>{value(item, "qualification")}</h3>
                    <p>
                      {value(item, "institution")}{" "}
                      {value(item, "period") ? `· ${value(item, "period")}` : ""}
                    </p>
                  </div>
                  <PublishChoice
                    itemKey={item.id}
                    itemType="education"
                    selected={selected(item.id)}
                    busy={busyKey === item.id}
                    onChange={selectForPortfolio}
                  />
                </article>
              ))}
              {content.certifications.map((item, itemIndex) => (
                <article key={`${item.id}-${String(itemIndex)}`}>
                  <div>
                    <h3>{value(item, "name")}</h3>
                    <p>
                      {value(item, "issuer")}{" "}
                      {value(item, "date") ? `· ${value(item, "date")}` : ""}
                    </p>
                  </div>
                  <PublishChoice
                    itemKey={item.id}
                    itemType="certification"
                    selected={selected(item.id)}
                    busy={busyKey === item.id}
                    onChange={selectForPortfolio}
                  />
                </article>
              ))}
            </div>
          </section>

          <section
            id="career-skills"
            className="career-skills"
            aria-labelledby="career-skills-title"
          >
            <header>
              <p className="eyebrow">Technical practice</p>
              <h2 id="career-skills-title">Skills grouped by how you use them.</h2>
            </header>
            <div className="career-lined-list">
              {technicalSkills.map((item, itemIndex) => (
                <article key={`${item.id}-${String(itemIndex)}`}>
                  <div>
                    <h3>{value(item, "category")}</h3>
                    <p>{expandTechnologyLabels(list(item, "skills")).join(" · ")}</p>
                  </div>
                  <PublishChoice
                    itemKey={item.id}
                    itemType="skill"
                    selected={selected(item.id)}
                    busy={busyKey === item.id}
                    onChange={selectForPortfolio}
                  />
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      <details id="career-add-source" className="career-manual-source">
        <summary>Add information that is not in a document or journal</summary>
        <form className="knowledge-entry-form" onSubmit={(event) => void addFact(event)}>
          <label>
            Information type
            <select
              value={factType}
              onChange={(event) => {
                setFactType(event.target.value as (typeof CAREER_FACT_TYPES)[number]);
              }}
            >
              {CAREER_FACT_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          {factType === "experience" ? (
            <div className="career-experience-fields">
              <label>
                Organisation
                <input
                  required
                  value={organization}
                  onChange={(event) => {
                    setOrganization(event.target.value);
                  }}
                />
              </label>
              <label>
                Role
                <input
                  required
                  value={role}
                  onChange={(event) => {
                    setRole(event.target.value);
                  }}
                />
              </label>
              <label>
                Period
                <input
                  value={period}
                  onChange={(event) => {
                    setPeriod(event.target.value);
                  }}
                />
              </label>
            </div>
          ) : null}
          <label>
            Information
            <textarea
              required
              rows={4}
              value={statement}
              onChange={(event) => {
                setStatement(event.target.value);
              }}
            />
          </label>
          <button disabled={saving} type="submit">
            {saving ? "Saving…" : "Save privately and update Career Brain"}
          </button>
        </form>
      </details>
      <PublicationControl />
    </main>
  );
}
