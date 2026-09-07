"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { WorkspaceToast } from "@/components/ui/workspace-toast";

type ApplicationStatus =
  | "draft"
  | "in_progress"
  | "ready"
  | "submitted"
  | "interviewing"
  | "offer"
  | "closed"
  | "withdrawn";
interface Answer {
  id: string;
  version: number;
  draft_text: string;
  final_text?: string | null;
  status: string;
  evidence_ids: string[];
  created_at: string;
}
interface Field {
  id: string;
  label: string;
  field_type: string;
  required: boolean;
  category?: string | null;
  sensitive: boolean;
  char_limit?: number | null;
  word_limit?: number | null;
  application_answer_versions?: Answer[];
}
interface Application {
  id: string;
  status: ApplicationStatus;
  application_profile_id?: string | null;
  notes?: string | null;
  revision: number;
  jobs?: {
    canonical_title?: string;
    canonical_company?: string;
    current_description?: string | null;
  } | null;
  application_status_history?: Array<{
    id: string;
    from_status?: string | null;
    to_status: string;
    reason?: string | null;
    transitioned_at: string;
  }>;
  application_required_materials?: Array<{
    id: string;
    material_type: string;
    label: string;
    required: boolean;
    status: string;
    notes?: string | null;
  }>;
  application_forms?: Array<{
    id: string;
    source_url?: string | null;
    captured_at: string;
    application_fields?: Field[];
  }>;
  application_documents?: Array<{
    id: string;
    original_filename?: string | null;
    document_kind: string;
    availability: string;
  }>;
  generated_artifacts?: Array<{
    id: string;
    artifact_type: string;
    title: string;
    artifact_versions?: Array<{ id: string; version: number; status: string }>;
  }>;
  application_packages?: Array<{ id: string; version: number; status: string }>;
  compensation_recommendations?: Array<{
    id: string;
    floor: number;
    target: number;
    stretch: number;
    currency: string;
    confidence: string;
    period?: string;
    observed_min?: number | null;
    observed_max?: number | null;
    benchmark?: number | null;
    strategy?: string | null;
    assumptions?: string[];
    normalized_evidence?: Array<{
      title: string;
      sourceUrl: string;
      annualValue: number;
      conversion: string;
      evidenceTier: string;
    }>;
  }>;
}
interface Profile {
  id: string;
  name: string;
  status: string;
  is_default: boolean;
  identity: Record<string, unknown>;
  contact: Record<string, unknown>;
  links: Record<string, unknown>;
  location: Record<string, unknown>;
  work_authorization: Record<string, unknown>;
  availability: Record<string, unknown>;
  languages: unknown;
}
interface CareerFact {
  id: string;
  fact_type: string;
  review_status: string;
  verified_by_owner: boolean;
  currentVersion?: { statement?: string } | null;
}
const transitions: Record<ApplicationStatus, ApplicationStatus[]> = {
  draft: ["in_progress", "withdrawn"],
  in_progress: ["ready", "submitted", "withdrawn"],
  ready: ["in_progress", "submitted", "withdrawn"],
  submitted: ["interviewing", "offer", "closed", "withdrawn"],
  interviewing: ["offer", "closed", "withdrawn"],
  offer: ["closed", "withdrawn"],
  closed: [],
  withdrawn: ["in_progress"]
};

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
function profileValue(profile: Profile | undefined, field: Field): string {
  if (!profile || profile.status !== "approved") return "";
  const label = field.label.toLowerCase();
  const category = field.category?.toLowerCase();
  const candidate = label.includes("email")
    ? profile.contact.email
    : label.includes("phone")
      ? profile.contact.phone
      : label.includes("linkedin")
        ? profile.links.linkedin
        : label.includes("portfolio") || label.includes("website")
          ? profile.links.portfolio
          : label.includes("name") || category === "identity"
            ? profile.identity.fullName
            : category === "location"
              ? profile.location.current
              : category === "work authorization"
                ? profile.work_authorization.summary
                : category === "availability"
                  ? profile.availability.notice
                  : category === "links"
                    ? profile.links.portfolio
                    : category === "contact"
                      ? profile.contact.email
                      : category === "languages"
                        ? profile.languages
                        : undefined;
  return Array.isArray(candidate)
    ? candidate.join(", ")
    : typeof candidate === "string"
      ? candidate
      : "";
}

export function ApplicationDetailWorkspace({ id }: { id: string }) {
  const [application, setApplication] = useState<Application | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [facts, setFacts] = useState<CareerFact[]>([]);
  const [evidenceIds, setEvidenceIds] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [preparingKit, setPreparingKit] = useState(false);
  const [autoPrepareAttempted, setAutoPrepareAttempted] = useState(false);
  const load = useCallback(async () => {
    try {
      const [applicationResponse, profileResponse, factsResponse] = await Promise.all([
        fetch(`/api/v1/applications/${id}`, { cache: "no-store" }),
        fetch("/api/v1/application-profiles", { cache: "no-store" }),
        fetch("/api/v1/career/facts", { cache: "no-store" })
      ]);
      if (!applicationResponse.ok || !profileResponse.ok || !factsResponse.ok) throw new Error();
      const applicationPayload = (await applicationResponse.json()) as { data?: Application };
      const profilePayload = (await profileResponse.json()) as { data?: { profiles?: Profile[] } };
      const factsPayload = (await factsResponse.json()) as { data?: CareerFact[] };
      setApplication(applicationPayload.data ?? null);
      setSelectedProfileId(applicationPayload.data?.application_profile_id ?? "");
      setProfiles(profilePayload.data?.profiles ?? []);
      setFacts(
        (factsPayload.data ?? []).filter(
          (fact) =>
            fact.verified_by_owner && ["approved", "edited_approved"].includes(fact.review_status)
        )
      );
      setState("ready");
    } catch {
      setState("error");
    }
  }, [id]);
  useEffect(() => void load(), [load]);
  useEffect(() => {
    if (state !== "ready" || !application || autoPrepareAttempted) return;
    if (application.generated_artifacts?.length) {
      setAutoPrepareAttempted(true);
      return;
    }
    setAutoPrepareAttempted(true);
    void prepareApplicationKit(true);
  }, [application, autoPrepareAttempted, state]);
  if (state === "loading")
    return (
      <main className="workspace-page">
        <p role="status">Loading application workspace…</p>
      </main>
    );
  if (state === "error" || !application)
    return (
      <main className="workspace-page">
        <p role="alert">The private application could not be loaded.</p>
      </main>
    );
  const defaultProfile =
    profiles.find((profile) => profile.id === selectedProfileId && profile.status === "approved") ??
    profiles.find((profile) => profile.is_default && profile.status === "approved") ??
    profiles.find((profile) => profile.status === "approved");

  async function selectProfile(profileId: string) {
    try {
      await write(`/api/v1/applications/${id}`, "PATCH", {
        applicationProfileId: profileId || null,
        revision: application?.revision ?? 0
      });
      setSelectedProfileId(profileId);
      setMessage(
        profileId ? "Application profile selected for this job." : "Application profile cleared."
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not select application profile.");
    }
  }

  async function updateNotes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await write(`/api/v1/applications/${id}`, "PATCH", {
        notes: form.get("notes"),
        revision: application?.revision
      });
      setMessage("Notes saved.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save notes.");
    }
  }
  async function prepareApplicationKit(silent = false) {
    setPreparingKit(true);
    try {
      const result = (await write(`/api/v1/applications/${id}/auto-prepare`, "POST", {})) as {
        generatedCount?: number;
        status?: string;
      };
      if (!silent || result.generatedCount) {
        setMessage(
          result.generatedCount
            ? `AI prepared ${String(result.generatedCount)} application document(s) from this job and your private career data.`
            : "The AI could not create a grounded document yet. Add or index a CV and career facts, then try again."
        );
      }
      await load();
    } catch (error) {
      if (!silent) {
        setMessage(error instanceof Error ? error.message : "Could not prepare the application kit.");
      }
    } finally {
      setPreparingKit(false);
    }
  }
  async function transition(status: ApplicationStatus) {
    const reason = window.prompt(`Why move this application to ${status}?`)?.trim();
    if (!reason) return;
    try {
      await write(`/api/v1/applications/${id}/transitions`, "POST", { status, reason });
      setMessage(`Application moved to ${status}.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not change status.");
    }
  }
  async function addMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await write(`/api/v1/applications/${id}/required-materials`, "POST", {
        label: form.get("label"),
        materialType: form.get("materialType"),
        required: form.get("required") === "on",
        notes: form.get("notes")
      });
      formElement.reset();
      setMessage("Required material added.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add material.");
    }
  }
  async function addField(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    const form = new FormData(target);
    try {
      const result = (await write(`/api/v1/applications/${id}/forms`, "POST", {
        sourceUrl: form.get("sourceUrl"),
        accessMethod: "manual",
        questionsText: form.get("questionsText"),
        fieldType: form.get("fieldType"),
        required: form.get("required") === "on",
        sensitive: form.get("sensitive") === "on",
        category: form.get("category"),
        charLimit: Number(form.get("charLimit")) || null,
        wordLimit: Number(form.get("wordLimit")) || null
      })) as { addedQuestionCount?: number; generation?: { generatedCount?: number } };
      target.reset();
      setMessage(
        `${String(result.addedQuestionCount ?? 0)} job-specific question(s) captured. ${String(result.generation?.generatedCount ?? 0)} answer(s) generated.`
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not capture field.");
    }
  }
  async function regenerateAnswers() {
    try {
      const result = (await write(`/api/v1/applications/${id}/answers/generate`, "POST", {})) as {
        status?: string;
        generatedCount?: number;
        needsOwnerInput?: number;
      };
      setMessage(
        `Answers regenerated: ${String(result.generatedCount ?? 0)} generated, ${String(result.needsOwnerInput ?? 0)} need explicit owner input.`
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not regenerate answers.");
    }
  }
  async function saveAnswer(field: Field, approved: boolean) {
    const text = answers[field.id] ?? profileValue(defaultProfile, field);
    try {
      await write(`/api/v1/application-fields/${field.id}/answer-drafts`, "POST", {
        text,
        source:
          answers[field.id] === undefined && profileValue(defaultProfile, field)
            ? "profile"
            : "owner",
        approved,
        explicitOwnerInput: field.sensitive && answers[field.id] !== undefined,
        evidenceIds: [],
        generationContext: { applicationId: id, deterministicProfileId: defaultProfile?.id ?? null }
      });
      setMessage(approved ? "Answer approved and versioned." : "Draft answer version saved.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save answer.");
    }
  }

  async function composeArtifact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await write(`/api/v1/applications/${id}/compose`, "POST", {
        artifactType: form.get("artifactType"),
        title: form.get("title"),
        content: form.get("content"),
        template: form.get("template"),
        tone: form.get("tone"),
        evidenceIds
      });
      formElement.reset();
      setEvidenceIds([]);
      setMessage("Evidence-backed PDF draft created as immutable version 1.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not compose artifact.");
    }
  }

  async function reviewArtifact(versionId: string, action: "review" | "final" | "reject") {
    try {
      await write(`/api/v1/artifact-versions/${versionId}/review`, "POST", {
        decision: action === "reject" ? "rejected" : "approved",
        markFinal: action === "final",
        notes: "Owner decision from application workspace"
      });
      setMessage(
        `Artifact ${action === "final" ? "marked final" : action === "reject" ? "rejected" : "reviewed"}.`
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not review artifact.");
    }
  }

  async function snapshotArtifact(versionId: string) {
    try {
      await write(`/api/v1/artifact-versions/${versionId}/submitted-snapshot`, "POST", {});
      setMessage("Exact final binary preserved as the submitted snapshot.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not preserve snapshot.");
    }
  }

  async function researchCompensation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const evidence = form.get("evidence");
    const sources =
      typeof evidence === "string"
        ? evidence
            .split(/\r?\n/)
            .filter(Boolean)
            .map((line) => {
              const [title, sourceUrl, value, currency, period, evidenceTier, observedAt] = line
                .split("|")
                .map((item) => item.trim());
              return {
                title,
                sourceUrl,
                value: Number(value),
                currency,
                period,
                evidenceTier,
                observedAt
              };
            })
        : [];
    try {
      await write(`/api/v1/applications/${id}/compensation-research`, "POST", {
        sources,
        strategy: form.get("strategy")
      });
      setMessage("Compensation evidence normalized and recommendation version saved.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not analyze compensation.");
    }
  }

  const fields =
    application.application_forms?.flatMap((form) => form.application_fields ?? []) ?? [];
  return (
    <main className="workspace-page">
      <header className="workspace-heading">
        <p className="eyebrow">Private application</p>
        <h1>{application.jobs?.canonical_title ?? "Application"}</h1>
        <p>
          {application.jobs?.canonical_company ?? "Company"} · {application.status}
        </p>
        <Link href="/applications">Back to applications</Link>
      </header>
      <section>
        <h2>Overview and lifecycle</h2>
        <label>
          Application profile for this job
          <select
            value={selectedProfileId}
            onChange={(event) => void selectProfile(event.target.value)}
          >
            <option value="">Use default approved profile</option>
            {profiles
              .filter((profile) => profile.status === "approved")
              .map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                  {profile.is_default ? " (default)" : ""}
                </option>
              ))}
          </select>
          <small>
            This selection controls deterministic contact fields and the context used for answers.
            It never rewrites approved profile values.
          </small>
        </label>
        <div className="workspace-actions">
          {transitions[application.status].map((status) => (
            <button type="button" key={status} onClick={() => void transition(status)}>
              Move to {status}
            </button>
          ))}
        </div>
        <form className="knowledge-entry-form" onSubmit={(event) => void updateNotes(event)}>
          <label>
            Company and preparation notes
            <textarea name="notes" rows={5} defaultValue={application.notes ?? ""} />
          </label>
          <button type="submit">Save notes</button>
        </form>
        <h3>Timeline</h3>
        {application.application_status_history?.length ? (
          <ol>
            {[...application.application_status_history]
              .sort((a, b) => a.transitioned_at.localeCompare(b.transitioned_at))
              .map((entry) => (
                <li key={entry.id}>
                  {entry.from_status ?? "created"} → {entry.to_status} ·{" "}
                  {entry.reason || "No reason"}
                </li>
              ))}
          </ol>
        ) : (
          <p>No transitions recorded.</p>
        )}
      </section>
      <section>
        <h2>Readiness and required materials</h2>
        <form className="knowledge-entry-form" onSubmit={(event) => void addMaterial(event)}>
          <label>
            Material type
            <select name="materialType">
              <option value="cv">CV</option>
              <option value="cover_letter">Cover letter</option>
              <option value="answer">Answer</option>
              <option value="portfolio">Portfolio</option>
              <option value="certificate">Certificate</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            Label
            <input name="label" required />
          </label>
          <label>
            Notes
            <input name="notes" />
          </label>
          <label>
            <input name="required" type="checkbox" defaultChecked /> Required
          </label>
          <button type="submit">Add material</button>
        </form>
        {application.application_required_materials?.length ? (
          <ul className="workspace-list">
            {application.application_required_materials.map((material) => (
              <li key={material.id}>
                <strong>{material.label}</strong> · {material.status}
                {material.required ? " · required" : ""}
                <p>{material.notes}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p>No required materials have been recorded.</p>
        )}
      </section>
      <section>
        <h2>Application form and answers</h2>
        <p>
          This section is optional. The AI prepares the kit without a form. When an employer asks
          additional questions that cannot be imported automatically, add them here and answers
          will be generated for the exact wording. Separate each question with a blank paragraph;
          they are stored only on this application, never in your application profile. Sensitive and
          legal responses are never inferred.
        </p>
        <div className="workspace-actions">
          <button type="button" onClick={() => void regenerateAnswers()}>
            Regenerate AI answers
          </button>
        </div>
        <details>
          <summary>Add employer questions (optional)</summary>
          <form className="knowledge-entry-form" onSubmit={(event) => void addField(event)}>
          <label>
            Application URL (optional)
            <input name="sourceUrl" type="url" />
          </label>
          <label>
            Additional employer questions
            <textarea
              name="questionsText"
              rows={8}
              placeholder={
                "Why do you want to work here?\n\nDescribe your experience with Airflow.\n\nWhat are your salary expectations?"
              }
            />
            <small>
              Use one blank line between questions. Each paragraph becomes a separate answer field.
            </small>
          </label>
          <label>
            Field type
            <select name="fieldType">
              <option value="textarea">Long answer</option>
              <option value="text">Short text</option>
              <option value="url">URL</option>
              <option value="select">Select</option>
            </select>
          </label>
          <label>
            Category
            <select name="category">
              <option value="career facts">Career facts</option>
              <option value="experience">Experience</option>
              <option value="motivation">Motivation</option>
              <option value="identity">Identity</option>
              <option value="contact">Contact</option>
              <option value="work authorization">Work authorization</option>
              <option value="compensation">Compensation</option>
              <option value="availability">Availability</option>
              <option value="links">Links</option>
              <option value="voluntary demographics">Voluntary demographics</option>
            </select>
          </label>
          <label>
            Character limit
            <input name="charLimit" type="number" min="1" />
          </label>
          <label>
            Word limit
            <input name="wordLimit" type="number" min="1" />
          </label>
          <label>
            <input name="required" type="checkbox" /> Required
          </label>
          <label>
            <input name="sensitive" type="checkbox" /> Sensitive / voluntary demographic
          </label>
            <button type="submit">Capture and generate answers</button>
          </form>
        </details>
        {fields.length ? (
          <ul className="workspace-list">
            {fields.map((field) => {
              const latest = [...(field.application_answer_versions ?? [])].sort(
                (a, b) => b.version - a.version
              )[0];
              const deterministic = profileValue(defaultProfile, field);
              return (
                <li key={field.id}>
                  <strong>{field.label}</strong>
                  <p>
                    {field.category ?? "other"} · {field.required ? "required" : "optional"}
                    {field.sensitive ? " · sensitive—explicit input required" : ""}
                  </p>
                  <textarea
                    aria-label={`Answer for ${field.label}`}
                    rows={5}
                    value={
                      answers[field.id] ??
                      (deterministic || latest?.final_text || latest?.draft_text || "")
                    }
                    onChange={(event) => {
                      setAnswers((current) => ({ ...current, [field.id]: event.target.value }));
                    }}
                  />
                  {deterministic ? (
                    <p>Filled exactly from approved profile: {defaultProfile?.name}</p>
                  ) : null}
                  <div className="workspace-actions">
                    <button type="button" onClick={() => void saveAnswer(field, false)}>
                      Save owner edit
                    </button>
                    <button type="button" onClick={() => void saveAnswer(field, true)}>
                      Approve final answer
                    </button>
                  </div>
                  {latest ? (
                    <p>
                      Latest: version {String(latest.version)} · {latest.status} ·{" "}
                      {latest.evidence_ids.length
                        ? `${String(latest.evidence_ids.length)} evidence links`
                        : "owner/profile input; no evidence links"}
                    </p>
                  ) : (
                    <p>No saved answer.</p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p>No form fields captured yet.</p>
        )}
      </section>
      <section>
        <h2>AI-prepared application documents</h2>
        <p>
          You do not need to write a CV or cover letter here. The application writer uses the job
          description, your selected profile, indexed CVs, Career Brain, and private career facts to
          prepare tailored drafts. Review them before using them.
        </p>
        <div className="workspace-actions">
          <button type="button" disabled={preparingKit} onClick={() => void prepareApplicationKit()}>
            {preparingKit ? "Preparing with AI…" : "Prepare / refresh CV and cover letter"}
          </button>
        </div>
        {!application.generated_artifacts?.length ? (
          <p>Preparing automatically… if no draft appears, index a CV or add verified career facts and retry.</p>
        ) : null}
        <details>
          <summary>Advanced: compose a document manually</summary>
          <p>Manual composition is optional and is not required to prepare an application.</p>
          <form className="knowledge-entry-form" onSubmit={(event) => void composeArtifact(event)}>
          <label>
            Artifact type
            <select name="artifactType">
              <option value="resume">CV / resume</option>
              <option value="cover_letter">Cover letter</option>
            </select>
          </label>
          <label>
            Title
            <input name="title" required />
          </label>
          <label>
            Presentation style
            <select name="template">
              <option value="technical">Technical</option>
              <option value="minimal">Minimal</option>
              <option value="modern">Modern</option>
              <option value="executive">Executive</option>
            </select>
          </label>
          <label>
            Tone
            <select name="tone">
              <option value="professional">Professional</option>
              <option value="direct">Direct</option>
              <option value="warm">Warm</option>
            </select>
          </label>
          <label>
            Editable structured content
            <textarea
              name="content"
              rows={14}
              required
              placeholder="Write or edit sections and bullets here. The renderer controls document layout."
            />
          </label>
          <fieldset>
            <legend>Verified supporting facts</legend>
            {facts.length ? (
              facts.map((fact) => (
                <label key={fact.id}>
                  <input
                    type="checkbox"
                    checked={evidenceIds.includes(fact.id)}
                    onChange={() => {
                      setEvidenceIds((current) =>
                        current.includes(fact.id)
                          ? current.filter((value) => value !== fact.id)
                          : [...current, fact.id]
                      );
                    }}
                  />{" "}
                  {fact.currentVersion?.statement ?? fact.fact_type}
                </label>
              ))
            ) : (
              <p>Approve facts in Career Brain before composing evidence-backed materials.</p>
            )}
          </fieldset>
            <button type="submit" disabled={!facts.length}>
              Create private PDF draft
            </button>
          </form>
        </details>
        {application.generated_artifacts?.length ? (
          <ul className="workspace-list">
            {application.generated_artifacts.map((artifact) => (
              <li key={artifact.id}>
                <strong>{artifact.title}</strong> · {artifact.artifact_type}
                <p>{artifact.artifact_versions?.length ?? 0} immutable versions</p>
                <ul>
                  {artifact.artifact_versions?.map((version) => (
                    <li key={version.id}>
                      Version {String(version.version)} · {version.status}
                      <div className="workspace-actions">
                        <a href={`/api/v1/artifact-versions/${version.id}/export`}>Download PDF</a>
                        {version.status === "draft" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void reviewArtifact(version.id, "review")}
                            >
                              Mark reviewed
                            </button>
                            <button
                              type="button"
                              onClick={() => void reviewArtifact(version.id, "final")}
                            >
                              Approve final
                            </button>
                            <button
                              type="button"
                              onClick={() => void reviewArtifact(version.id, "reject")}
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                        {version.status === "owner_reviewed" ? (
                          <button
                            type="button"
                            onClick={() => void reviewArtifact(version.id, "final")}
                          >
                            Approve final
                          </button>
                        ) : null}
                        {version.status === "final" ? (
                          <button type="button" onClick={() => void snapshotArtifact(version.id)}>
                            Preserve submitted snapshot
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <p>No generated artifacts yet.</p>
        )}
      </section>
      <section>
        <h2>Documents</h2>
        {application.application_documents?.length ? (
          <ul>
            {application.application_documents.map((document) => (
              <li key={document.id}>
                {document.original_filename ?? document.document_kind} · {document.availability}
              </li>
            ))}
          </ul>
        ) : (
          <p>No private source documents linked.</p>
        )}
      </section>
      <section>
        <h2>Compensation research</h2>
        <form
          className="knowledge-entry-form"
          onSubmit={(event) => void researchCompensation(event)}
        >
          <label>
            Strategy
            <select name="strategy">
              <option value="conservative">Conservative</option>
              <option value="market_competitive">Market competitive</option>
              <option value="aggressive">Aggressive</option>
              <option value="maximum_reasonable">Maximum reasonable</option>
            </select>
          </label>
          <label>
            Market evidence, one source per line
            <textarea
              name="evidence"
              rows={6}
              required
              placeholder="Same role, country | https://example.com/source | 120000 | USD | annual | same_role_country | 2026-08-01"
            />
            <small>
              Columns: title | HTTPS source | value | currency | annual/monthly/hourly/daily |
              same_company_role/same_company_similar/same_role_city/same_role_country/comparable_market
              | observed date
            </small>
          </label>
          <button type="submit">Analyze compensation</button>
        </form>
        {application.compensation_recommendations?.length ? (
          <ul>
            {application.compensation_recommendations.map((item) => (
              <li key={item.id}>
                {item.currency} {String(item.floor)} / {String(item.target)} /{" "}
                {String(item.stretch)} · {item.confidence}
                <p>
                  Observed {String(item.observed_min ?? "?")}–{String(item.observed_max ?? "?")} ·
                  benchmark {String(item.benchmark ?? "?")} ·{" "}
                  {item.strategy ?? "strategy unavailable"}
                </p>
                {item.assumptions?.length ? (
                  <ul>
                    {item.assumptions.map((assumption) => (
                      <li key={assumption}>{assumption}</li>
                    ))}
                  </ul>
                ) : null}
                {item.normalized_evidence?.length ? (
                  <details>
                    <summary>Normalized evidence and conversions</summary>
                    <ul>
                      {item.normalized_evidence.map((source) => (
                        <li key={`${source.sourceUrl}-${source.title}`}>
                          <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                            {source.title}
                          </a>{" "}
                          · {String(source.annualValue)} {item.currency}/annual ·{" "}
                          {source.evidenceTier}
                          <br />
                          {source.conversion}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>No compensation recommendation yet.</p>
        )}
      </section>
      <section>
        <h2>Application packages</h2>
        {application.application_packages?.length ? (
          <ul>
            {application.application_packages.map((item) => (
              <li key={item.id}>
                Version {String(item.version)} · {item.status}
              </li>
            ))}
          </ul>
        ) : (
          <p>No package assembled yet.</p>
        )}
        <p>Final submission remains an owner action outside this application.</p>
      </section>
      <WorkspaceToast
        message={message}
        onDismiss={() => {
          setMessage("");
        }}
      />
    </main>
  );
}
