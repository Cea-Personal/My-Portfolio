"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

interface Application {
  id: string;
  status: string;
  created_at: string;
  jobs?: { canonical_title?: string; canonical_company?: string; location?: string | null } | null;
}
interface Job {
  id: string;
  canonical_title: string;
  canonical_company: string;
  status: string;
}
interface Profile {
  id: string;
  name: string;
  status: string;
  is_default: boolean;
  revision: number;
  identity?: Record<string, unknown>;
  contact?: Record<string, unknown>;
  links?: Record<string, unknown>;
  location?: Record<string, unknown>;
  work_authorization?: Record<string, unknown>;
  availability?: Record<string, unknown>;
  languages?: unknown;
}

interface ArtifactVersion {
  id: string;
  version: number;
  status: string;
}

interface Artifact {
  id: string;
  title: string;
  application_id?: string | null;
  artifact_type: string;
  artifact_versions?: ArtifactVersion[];
}

function profileText(section: Record<string, unknown> | undefined, key: string): string {
  const value = section?.[key];
  return typeof value === "string" ? value : "";
}

function profileList(value: unknown): string {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").join(", ")
    : "";
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

export function ApplicationsWorkspace() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [newApplicationProfileId, setNewApplicationProfileId] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    try {
      const [applicationsResponse, jobsResponse, profilesResponse, cvsResponse, lettersResponse] =
        await Promise.all([
          fetch("/api/v1/applications", { cache: "no-store" }),
          fetch("/api/v1/jobs", { cache: "no-store" }),
          fetch("/api/v1/application-profiles", { cache: "no-store" }),
          fetch("/api/v1/artifacts?type=resume", { cache: "no-store" }),
          fetch("/api/v1/artifacts?type=cover_letter", { cache: "no-store" })
        ]);
      if (
        !applicationsResponse.ok ||
        !jobsResponse.ok ||
        !profilesResponse.ok ||
        !cvsResponse.ok ||
        !lettersResponse.ok
      )
        throw new Error();
      const applicationPayload = (await applicationsResponse.json()) as {
        data?: { applications?: Application[] };
      };
      const jobPayload = (await jobsResponse.json()) as { data?: { jobs?: Job[] } };
      const profilePayload = (await profilesResponse.json()) as { data?: { profiles?: Profile[] } };
      const cvPayload = (await cvsResponse.json()) as { data?: Artifact[] };
      const letterPayload = (await lettersResponse.json()) as { data?: Artifact[] };
      setApplications(applicationPayload.data?.applications ?? []);
      setJobs(jobPayload.data?.jobs ?? []);
      setProfiles(profilePayload.data?.profiles ?? []);
      setArtifacts([...(cvPayload.data ?? []), ...(letterPayload.data ?? [])]);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);
  useEffect(() => void load(), [load]);

  async function createProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const languagesEntry = form.get("languages");
    try {
      await write("/api/v1/application-profiles", "POST", {
        name: form.get("name"),
        identity: { fullName: form.get("fullName") },
        contact: { email: form.get("email"), phone: form.get("phone") },
        links: { portfolio: form.get("portfolio"), linkedin: form.get("linkedin") },
        location: { current: form.get("location"), relocation: form.get("relocation") },
        workAuthorization: {
          summary: form.get("workAuthorization"),
          sponsorship: form.get("sponsorship")
        },
        availability: { notice: form.get("availability") },
        languages: (typeof languagesEntry === "string" ? languagesEntry : "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        education: [],
        certifications: [],
        approved: form.get("approved") === "on",
        isDefault: form.get("isDefault") === "on"
      });
      event.currentTarget.reset();
      setMessage("Application profile saved as an immutable version.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save profile.");
    }
  }
  async function startApplication(job: Job) {
    try {
      const data = (await write(`/api/v1/jobs/${job.id}/applications`, "POST", {
        applicationProfileId: newApplicationProfileId || null
      })) as {
        id?: string;
      };
      if (!data.id) throw new Error("Application was not created");
      window.location.assign(`/applications/${data.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start application.");
    }
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>, profile: Profile) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const languagesEntry = form.get("languages");
    try {
      await write(`/api/v1/application-profiles/${profile.id}`, "PATCH", {
        name: form.get("name"),
        identity: { fullName: form.get("fullName") },
        contact: { email: form.get("email"), phone: form.get("phone") },
        links: { portfolio: form.get("portfolio"), linkedin: form.get("linkedin") },
        location: { current: form.get("location"), relocation: form.get("relocation") },
        workAuthorization: {
          summary: form.get("workAuthorization"),
          sponsorship: form.get("sponsorship")
        },
        availability: { notice: form.get("availability") },
        languages: (typeof languagesEntry === "string" ? languagesEntry : "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        approved: form.get("approved") === "on",
        isDefault: form.get("isDefault") === "on"
      });
      setMessage(`${profile.name} was updated.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update profile.");
    }
  }

  async function deleteProfile(profile: Profile) {
    if (!window.confirm(`Archive the application profile “${profile.name}”?`)) return;
    try {
      const response = await fetch(`/api/v1/application-profiles/${profile.id}`, {
        method: "DELETE",
        headers: {
          "idempotency-key": `delete-application-profile-${profile.id}-${crypto.randomUUID()}`
        }
      });
      const payload = (await response.json().catch(() => ({}))) as { data?: unknown };
      if (!response.ok) {
        const problem = payload.data as { detail?: string; code?: string } | undefined;
        throw new Error(problem?.detail ?? problem?.code ?? "Could not archive profile.");
      }
      setMessage(`${profile.name} was archived and removed from future selections.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not archive profile.");
    }
  }
  const eligible = jobs.filter((job) =>
    ["shortlisted", "interested", "preparing_application", "ready_to_apply"].includes(job.status)
  );

  return (
    <main className="workspace-page">
      <header className="workspace-heading">
        <p className="eyebrow">Application operating system</p>
        <h1>Application Kit</h1>
        <p>
          Prepare materials, answers, research, and a submission snapshot. Nothing is submitted
          externally by this application.
        </p>
      </header>
      <section aria-labelledby="application-materials-title">
        <h2 id="application-materials-title">CVs and cover letters</h2>
        <p>
          Materials are created inside a selected application, remain versioned, and can be reviewed
          or downloaded without leaving Application Kit.
        </p>
        <div className="workspace-actions">
          <a href="/settings/documents">Upload or index a source CV</a>
          <a href="/cvs">View all CV versions</a>
          <a href="/cover-letters">View all cover-letter versions</a>
        </div>
        {artifacts.length ? (
          <ul className="workspace-list">
            {artifacts.map((artifact) => {
              const latest = [...(artifact.artifact_versions ?? [])].sort(
                (left, right) => right.version - left.version
              )[0];
              return (
                <li key={artifact.id}>
                  <strong>{artifact.title}</strong> ·{" "}
                  {artifact.artifact_type === "resume" ? "CV" : "Cover letter"}
                  <p>
                    {latest
                      ? `Version ${String(latest.version)} · ${latest.status}`
                      : "No version rendered yet"}
                  </p>
                  {artifact.application_id ? (
                    <a href={`/applications/${artifact.application_id}`}>Open its application</a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p>No generated CVs or cover letters yet. Start from an eligible job below.</p>
        )}
      </section>
      <section>
        <h2>Start from a job</h2>
        <label>
          Profile for new applications
          <select
            value={newApplicationProfileId}
            onChange={(event) => {
              setNewApplicationProfileId(event.target.value);
            }}
          >
            <option value="">Use the approved default profile</option>
            {profiles
              .filter((profile) => profile.status === "approved")
              .map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                  {profile.is_default ? " (default)" : ""}
                </option>
              ))}
          </select>
          <small>Each application keeps this choice and can be changed in its workspace.</small>
        </label>
        {eligible.length ? (
          <ul className="workspace-list">
            {eligible.map((job) => (
              <li key={job.id}>
                <strong>{job.canonical_title}</strong> · {job.canonical_company} · {job.status}
                <div className="workspace-actions">
                  <button type="button" onClick={() => void startApplication(job)}>
                    Open application workspace
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>Move a job to Shortlisted or Interested before starting an application.</p>
        )}
      </section>
      <section>
        <h2>Reusable application profile</h2>
        <p>
          Approved values fill deterministic fields exactly as written; they are not rewritten by
          AI.
        </p>
        <form className="knowledge-entry-form" onSubmit={(event) => void createProfile(event)}>
          <label>
            Profile name
            <input name="name" required />
          </label>
          <label>
            Full legal/preferred name
            <input name="fullName" />
          </label>
          <label>
            Email
            <input name="email" type="email" />
          </label>
          <label>
            Phone
            <input name="phone" />
          </label>
          <label>
            Current location
            <input name="location" />
          </label>
          <label>
            Portfolio URL
            <input name="portfolio" type="url" />
          </label>
          <label>
            LinkedIn URL
            <input name="linkedin" type="url" />
          </label>
          <label>
            Work authorization
            <input name="workAuthorization" />
          </label>
          <label>
            Sponsorship requirement
            <input name="sponsorship" />
          </label>
          <label>
            Relocation preference
            <input name="relocation" />
          </label>
          <label>
            Availability / notice
            <input name="availability" />
          </label>
          <label>
            Languages
            <input name="languages" placeholder="English, French" />
          </label>
          <label>
            <input name="approved" type="checkbox" /> Approve these values for deterministic fill
          </label>
          <label>
            <input name="isDefault" type="checkbox" /> Make default
          </label>
          <button type="submit">Save profile version</button>
        </form>
        {profiles.length ? (
          <ul className="workspace-list">
            {profiles.map((profile) => (
              <li key={profile.id}>
                <strong>{profile.name}</strong> · {profile.status} · version{" "}
                {String(profile.revision)}
                {profile.is_default ? " · default" : ""}
                <details>
                  <summary>Modify profile</summary>
                  <form
                    className="knowledge-entry-form"
                    onSubmit={(event) => void updateProfile(event, profile)}
                  >
                    <label>
                      Profile name
                      <input name="name" defaultValue={profile.name} required />
                    </label>
                    <label>
                      Full legal/preferred name
                      <input
                        name="fullName"
                        defaultValue={profileText(profile.identity, "fullName")}
                      />
                    </label>
                    <label>
                      Email
                      <input
                        name="email"
                        type="email"
                        defaultValue={profileText(profile.contact, "email")}
                      />
                    </label>
                    <label>
                      Phone
                      <input name="phone" defaultValue={profileText(profile.contact, "phone")} />
                    </label>
                    <label>
                      Current location
                      <input
                        name="location"
                        defaultValue={profileText(profile.location, "current")}
                      />
                    </label>
                    <label>
                      Portfolio URL
                      <input
                        name="portfolio"
                        type="url"
                        defaultValue={profileText(profile.links, "portfolio")}
                      />
                    </label>
                    <label>
                      LinkedIn URL
                      <input
                        name="linkedin"
                        type="url"
                        defaultValue={profileText(profile.links, "linkedin")}
                      />
                    </label>
                    <label>
                      Work authorization
                      <input
                        name="workAuthorization"
                        defaultValue={profileText(profile.work_authorization, "summary")}
                      />
                    </label>
                    <label>
                      Sponsorship requirement
                      <input
                        name="sponsorship"
                        defaultValue={profileText(profile.work_authorization, "sponsorship")}
                      />
                    </label>
                    <label>
                      Relocation preference
                      <input
                        name="relocation"
                        defaultValue={profileText(profile.location, "relocation")}
                      />
                    </label>
                    <label>
                      Availability / notice
                      <input
                        name="availability"
                        defaultValue={profileText(profile.availability, "notice")}
                      />
                    </label>
                    <label>
                      Languages
                      <input name="languages" defaultValue={profileList(profile.languages)} />
                    </label>
                    <label>
                      <input
                        name="approved"
                        type="checkbox"
                        defaultChecked={profile.status === "approved"}
                      />{" "}
                      Approved for deterministic fill
                    </label>
                    <label>
                      <input name="isDefault" type="checkbox" defaultChecked={profile.is_default} />{" "}
                      Make default
                    </label>
                    <button type="submit">Save profile changes</button>
                  </form>
                </details>
                <button type="button" onClick={() => void deleteProfile(profile)}>
                  Delete profile
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No reusable profile yet.</p>
        )}
      </section>
      <section>
        <h2>Application pipeline</h2>
        {state === "loading" ? <p role="status">Loading applications…</p> : null}
        {state === "error" ? (
          <p role="alert">Could not load the private application workspace.</p>
        ) : null}
        {state === "ready" && !applications.length ? <p>No applications yet.</p> : null}
        <ul className="workspace-list">
          {applications.map((application) => (
            <li key={application.id}>
              <strong>{application.jobs?.canonical_title ?? "Role"}</strong>
              <p>
                {application.jobs?.canonical_company ?? "Company"} · {application.status} ·{" "}
                {new Date(application.created_at).toLocaleDateString()}
              </p>
              <Link href={`/applications/${application.id}`}>Open workspace</Link>
            </li>
          ))}
        </ul>
      </section>
      {message ? <p role="status">{message}</p> : null}
    </main>
  );
}
