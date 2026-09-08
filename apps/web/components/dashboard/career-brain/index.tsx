"use client";

import { useCallback, useEffect, useState } from "react";
import { CAREER_FACT_TYPES } from "@/lib/career-fact-taxonomy";
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

const value = (item: CareerBrainItem, key: string) =>
  typeof item[key] === "string" ? item[key] : "";
const list = (item: CareerBrainItem, key: string) =>
  Array.isArray(item[key])
    ? item[key].filter((entry): entry is string => typeof entry === "string")
    : [];

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

  const applyPayload = useCallback(
    (payload: { snapshot?: Snapshot | null; selections?: Selection[] }) => {
      setSnapshot(payload.snapshot ?? null);
      setSelections(payload.selections ?? []);
      setState("ready");
    },
    []
  );

  const regenerate = useCallback(
    async (quiet = false) => {
      setGenerating(true);
      if (!quiet) setNotice(null);
      const response = await fetch("/api/v1/career/brain", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `career-brain-${crypto.randomUUID()}`
        },
        body: "{}"
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
      if (!quiet) setNotice("Career Brain regenerated from the latest private evidence.");
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
        void regenerate(true);
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
        <button disabled={generating} type="button" onClick={() => void regenerate()}>
          {generating ? "Reading and synthesizing…" : "Refresh from all private sources"}
        </button>
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
        <div className="career-synthesis">
          <section className="career-narratives" aria-labelledby="career-narratives-title">
            <header>
              <p className="eyebrow">Profiles</p>
              <h2 id="career-narratives-title">Your story, shaped for its destination.</h2>
            </header>
            <article>
              <h3>CV profile summary</h3>
              <p>{content.cvSummary || "More evidence is needed to form a CV summary."}</p>
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(content.cvSummary)}
              >
                Copy CV summary
              </button>
            </article>
            <article>
              <h3>Portfolio profile summary</h3>
              <p>
                {content.portfolioSummary || "More evidence is needed to form a portfolio summary."}
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
              <p>{content.about || "More evidence is needed to form an About narrative."}</p>
              <PublishChoice
                itemKey="profile:about"
                itemType="about"
                selected={selected("profile:about")}
                busy={busyKey === "profile:about"}
                onChange={selectForPortfolio}
              />
            </article>
          </section>

          <section aria-labelledby="career-experiences-title">
            <header>
              <p className="eyebrow">Experience</p>
              <h2 id="career-experiences-title">Roles, organisations, and the work within them.</h2>
              <p>
                Repeated CV entries for the same role are merged. For each role, Career Brain
                keeps the strongest six or seven verified responsibility, achievement, and impact
                points, ranked against your recent target job descriptions.
              </p>
            </header>
            <div className="career-synthesis-list">
              {content.experiences.map((item) => (
                <details key={item.id}>
                  <summary>
                    <span>
                      <strong>{value(item, "role")}</strong>
                      <small>
                        {value(item, "organization")} · {value(item, "period")}
                      </small>
                    </span>
                    <em>{value(item, "summary")}</em>
                  </summary>
                  <div className="career-synthesis-detail">
                    {(["responsibilities", "achievements", "impact", "projects"] as const).map((key) =>
                      list(item, key).length ? (
                        <section key={key}>
                          <h3>
                            {key === "achievements"
                              ? "Achievements"
                              : key === "impact"
                                ? "Impact and outcomes"
                                : key.charAt(0).toUpperCase() + key.slice(1)}
                          </h3>
                          <ul>
                            {list(item, key).map((entry) => (
                              <li key={entry}>{entry}</li>
                            ))}
                          </ul>
                        </section>
                      ) : null
                    )}
                    {list(item, "technologies").length ? (
                      <p>
                        <strong>Technical skills:</strong> {list(item, "technologies").join(", ")}
                      </p>
                    ) : null}
                    {list(item, "evidence").length ? (
                      <details>
                        <summary>Source details</summary>
                        <ul>
                          {list(item, "evidence").map((entry) => (
                            <li key={entry}>{entry}</li>
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

          <section aria-labelledby="career-projects-title">
            <header>
              <p className="eyebrow">Selected projects</p>
              <h2 id="career-projects-title">Systems and ideas with evidence behind them.</h2>
            </header>
            <div className="career-editorial-grid">
              {content.projects.map((item) => (
                <article key={item.id}>
                  <h3>{value(item, "title")}</h3>
                  <p>{value(item, "summary")}</p>
                  {value(item, "outcome") ? (
                    <p>
                      <strong>Outcome:</strong> {value(item, "outcome")}
                    </p>
                  ) : null}
                  {list(item, "process").length ? (
                    <div>
                      <strong>How it was built</strong>
                      <ul>
                        {list(item, "process").map((entry) => (
                          <li key={entry}>{entry}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <small>{list(item, "technologies").join(" · ")}</small>
                  {list(item, "evidence").length ? (
                    <details>
                      <summary>Source details</summary>
                      <ul>
                        {list(item, "evidence").map((entry) => (
                          <li key={entry}>{entry}</li>
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
            </div>
          </section>

          <section className="career-credentials" aria-labelledby="career-credentials-title">
            <header>
              <p className="eyebrow">Credentials</p>
              <h2 id="career-credentials-title">Education and certifications</h2>
            </header>
            <div className="career-lined-list">
              {content.education.map((item) => (
                <article key={item.id}>
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
              {content.certifications.map((item) => (
                <article key={item.id}>
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

          <section className="career-skills" aria-labelledby="career-skills-title">
            <header>
              <p className="eyebrow">Technical practice</p>
              <h2 id="career-skills-title">Skills grouped by how you use them.</h2>
            </header>
            <div className="career-lined-list">
              {content.technicalSkills.map((item) => (
                <article key={item.id}>
                  <div>
                    <h3>{value(item, "category")}</h3>
                    <p>{list(item, "skills").join(" · ")}</p>
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

      <details className="career-manual-source">
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
