"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

interface SourceConfig {
  endpoint?: string;
  secret_ref?: string | null;
  rate_limit_per_minute?: number;
  last_test_outcome?: string | null;
}

interface JobSource {
  id: string;
  name: string;
  adapter_type: string;
  adapter_version: string;
  enabled: boolean;
  health_status: string;
  job_source_configs?: SourceConfig[] | SourceConfig;
}

interface SearchProfile {
  id: string;
  name: string;
  enabled: boolean;
  target_titles: string[];
  locations: string[];
  work_arrangements: string[];
  employment_types: string[];
  required_technologies: string[];
  preferred_technologies: string[];
  excluded_technologies: string[];
  scoring_weights: Record<string, number>;
  timezone: string;
}

function list(value: FormDataEntryValue | null): string[] {
  return typeof value === "string"
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

async function request(endpoint: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
  const response = await fetch(endpoint, {
    method,
    headers: {
      "content-type": "application/json",
      "idempotency-key": `${method.toLowerCase()}-${crypto.randomUUID()}`,
      ...(method === "PATCH" ? { "if-match": "*" } : {})
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const payload = (await response.json().catch(() => ({}))) as {
    data?: unknown;
  };
  if (!response.ok) {
    const detail = payload.data as { detail?: string; code?: string } | undefined;
    throw new Error(detail?.detail ?? detail?.code ?? "Request failed");
  }
  return payload.data;
}

function configFor(source: JobSource): SourceConfig {
  return Array.isArray(source.job_source_configs)
    ? (source.job_source_configs[0] ?? {})
    : (source.job_source_configs ?? {});
}

export function JobSourcesWorkspace() {
  const [sources, setSources] = useState<JobSource[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/job-sources", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const payload = (await response.json()) as { data?: { sources?: JobSource[] } };
      setSources(payload.data?.sources ?? []);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => void load(), [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Saving source…");
    const form = new FormData(event.currentTarget);
    try {
      await request("/api/v1/job-sources", "POST", {
        name: form.get("name"),
        adapterType: form.get("adapterType"),
        endpoint: form.get("endpoint"),
        secretRef: form.get("secretRef"),
        rateLimitPerMinute: Number(form.get("rateLimit")),
        termsNote: form.get("termsNote"),
        enabled: form.get("enabled") === "on"
      });
      event.currentTarget.reset();
      setMessage("Source saved. Test it before using it in a search.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save source.");
    }
  }

  async function toggle(source: JobSource) {
    setMessage(`${source.enabled ? "Disabling" : "Enabling"} ${source.name}…`);
    try {
      await request(`/api/v1/job-sources/${source.id}`, "PATCH", { enabled: !source.enabled });
      setMessage(`${source.name} is now ${source.enabled ? "disabled" : "enabled"}.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update source.");
    }
  }

  async function updateSource(event: FormEvent<HTMLFormElement>, source: JobSource) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage(`Updating ${source.name}…`);
    try {
      await request(`/api/v1/job-sources/${source.id}`, "PATCH", {
        name: form.get("name"),
        endpoint: form.get("endpoint"),
        secretRef: form.get("secretRef"),
        rateLimitPerMinute: Number(form.get("rateLimit")),
        termsNote: form.get("termsNote")
      });
      setMessage(`${source.name} was updated. Run a new connection test.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update source.");
    }
  }

  async function test(source: JobSource) {
    setMessage(`Testing ${source.name}…`);
    try {
      const result = (await request(`/api/v1/job-sources/${source.id}/tests`, "POST")) as {
        recordCount?: number;
        latencyMs?: number;
      };
      setMessage(
        `${source.name} connected in ${String(result.latencyMs ?? 0)} ms; ${String(result.recordCount ?? 0)} records were readable.`
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Connection test failed.");
      await load();
    }
  }

  return (
    <main className="workspace-page">
      <header className="workspace-heading">
        <p className="eyebrow">Opportunity intake</p>
        <h1>Job sources</h1>
        <p>
          Connect approved HTTPS feeds. Credentials remain server-side and only their
          environment-variable name is stored.
        </p>
      </header>
      <section aria-labelledby="new-source-title">
        <h2 id="new-source-title">Add a source</h2>
        <form className="knowledge-entry-form" onSubmit={(event) => void create(event)}>
          <label>
            Name
            <input name="name" required maxLength={160} />
          </label>
          <label>
            Adapter
            <select name="adapterType" defaultValue="greenhouse">
              <option value="greenhouse">Greenhouse</option>
              <option value="lever">Lever</option>
              <option value="ashby">Ashby</option>
              <option value="linkedin-authorized">LinkedIn (authorized feed)</option>
              <option value="rss">RSS</option>
              <option value="custom-rest">Custom REST</option>
            </select>
          </label>
          <label>
            HTTPS endpoint
            <input
              name="endpoint"
              type="url"
              required
              placeholder="https://boards-api.greenhouse.io/v1/boards/company/jobs"
            />
          </label>
          <p>
            LinkedIn is supported through an authorized/licensed feed or partner endpoint only. For
            a normal LinkedIn listing, paste the URL in Jobs; this app stores the link and does not
            scrape LinkedIn.
          </p>
          <label>
            Secret environment variable (optional)
            <input
              name="secretRef"
              pattern="[A-Z][A-Z0-9_]{2,79}"
              placeholder="JOB_SOURCE_API_TOKEN"
            />
            <small>Enter a variable name, never an API key.</small>
          </label>
          <label>
            Rate limit per minute
            <input name="rateLimit" type="number" min="1" max="300" defaultValue="30" required />
          </label>
          <label>
            Terms / lawful-use note
            <textarea name="termsNote" rows={3} maxLength={1000} />
          </label>
          <label>
            <input name="enabled" type="checkbox" /> Enable after saving
          </label>
          <button type="submit">Save source</button>
        </form>
      </section>
      <section aria-labelledby="configured-sources-title">
        <h2 id="configured-sources-title">Configured sources</h2>
        {state === "loading" ? <p role="status">Loading sources…</p> : null}
        {state === "error" ? <p role="alert">Could not load private job sources.</p> : null}
        {state === "ready" && !sources.length ? <p>No job sources configured.</p> : null}
        <ul className="workspace-list">
          {sources.map((source) => {
            const config = configFor(source);
            return (
              <li key={source.id}>
                <strong>{source.name}</strong>
                <p>
                  {source.adapter_type}@{source.adapter_version} ·{" "}
                  {source.enabled ? "enabled" : "disabled"} · health: {source.health_status}
                </p>
                <p>{config.endpoint}</p>
                {config.last_test_outcome ? (
                  <details>
                    <summary>Last sanitized diagnostic</summary>
                    <code>{config.last_test_outcome}</code>
                  </details>
                ) : null}
                <details>
                  <summary>Edit configuration</summary>
                  <form
                    className="knowledge-entry-form"
                    onSubmit={(event) => void updateSource(event, source)}
                  >
                    <label>
                      Name
                      <input name="name" defaultValue={source.name} required />
                    </label>
                    <label>
                      HTTPS endpoint
                      <input name="endpoint" type="url" defaultValue={config.endpoint} required />
                    </label>
                    <label>
                      Secret environment variable
                      <input
                        name="secretRef"
                        defaultValue={config.secret_ref ?? ""}
                        pattern="[A-Z][A-Z0-9_]{2,79}"
                      />
                    </label>
                    <label>
                      Rate limit per minute
                      <input
                        name="rateLimit"
                        type="number"
                        min="1"
                        max="300"
                        defaultValue={config.rate_limit_per_minute ?? 30}
                      />
                    </label>
                    <label>
                      Terms / lawful-use note
                      <textarea name="termsNote" rows={2} maxLength={1000} />
                    </label>
                    <button type="submit">Update source</button>
                  </form>
                </details>
                <div className="workspace-actions">
                  <button type="button" onClick={() => void test(source)}>
                    Test connection
                  </button>
                  <button type="button" onClick={() => void toggle(source)}>
                    {source.enabled ? "Disable" : "Enable"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      {message ? <p role="status">{message}</p> : null}
    </main>
  );
}

export function SearchProfilesWorkspace() {
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/search-profiles", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const payload = (await response.json()) as { data?: { profiles?: SearchProfile[] } };
      setProfiles(payload.data?.profiles ?? []);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);
  useEffect(() => void load(), [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Saving search profile…");
    const form = new FormData(event.currentTarget);
    try {
      await request("/api/v1/search-profiles", "POST", {
        name: form.get("name"),
        targetTitles: list(form.get("targetTitles")),
        locations: list(form.get("locations")),
        workArrangements: list(form.get("workArrangements")),
        employmentTypes: list(form.get("employmentTypes")),
        requiredTechnologies: list(form.get("requiredTechnologies")),
        preferredTechnologies: list(form.get("preferredTechnologies")),
        excludedTechnologies: list(form.get("excludedTechnologies")),
        timezone: form.get("timezone"),
        enabled: form.get("enabled") === "on",
        scoringWeights: {
          alignment: Number(form.get("alignment")),
          growth: Number(form.get("growth")),
          compensation: Number(form.get("compensation")),
          logistics: Number(form.get("logistics"))
        }
      });
      event.currentTarget.reset();
      setMessage("Search profile saved.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save profile.");
    }
  }

  async function toggle(profile: SearchProfile) {
    try {
      await request(`/api/v1/search-profiles/${profile.id}`, "PATCH", {
        enabled: !profile.enabled
      });
      setMessage(`${profile.name} is now ${profile.enabled ? "disabled" : "enabled"}.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update profile.");
    }
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>, profile: SearchProfile) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await request(`/api/v1/search-profiles/${profile.id}`, "PATCH", {
        name: form.get("name"),
        targetTitles: list(form.get("targetTitles")),
        locations: list(form.get("locations")),
        workArrangements: list(form.get("workArrangements")),
        employmentTypes: list(form.get("employmentTypes")),
        requiredTechnologies: list(form.get("requiredTechnologies")),
        preferredTechnologies: list(form.get("preferredTechnologies")),
        excludedTechnologies: list(form.get("excludedTechnologies")),
        timezone: form.get("timezone"),
        scoringWeights: {
          alignment: Number(form.get("alignment")),
          growth: Number(form.get("growth")),
          compensation: Number(form.get("compensation")),
          logistics: Number(form.get("logistics"))
        }
      });
      setMessage(`${profile.name} was updated.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update profile.");
    }
  }

  async function deleteProfile(profile: SearchProfile) {
    if (!window.confirm(`Archive the search profile “${profile.name}”?`)) return;
    try {
      await request(`/api/v1/search-profiles/${profile.id}`, "DELETE");
      setMessage(`${profile.name} was archived and removed from future searches.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not archive profile.");
    }
  }

  return (
    <main className="workspace-page">
      <header className="workspace-heading">
        <p className="eyebrow">Search strategy</p>
        <h1>Search profiles</h1>
        <p>
          Describe the roles, locations, working arrangements, and technologies that define a useful
          opportunity.
        </p>
      </header>
      <section>
        <h2>New profile</h2>
        <form className="knowledge-entry-form" onSubmit={(event) => void create(event)}>
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Target titles
            <input
              name="targetTitles"
              required
              placeholder="Senior Data Engineer, Data Platform Engineer"
            />
          </label>
          <label>
            Locations
            <input name="locations" placeholder="Remote, Kigali, London" />
          </label>
          <label>
            Work arrangements
            <input name="workArrangements" placeholder="remote, hybrid" />
          </label>
          <label>
            Employment types
            <input name="employmentTypes" placeholder="permanent, contract" />
          </label>
          <label>
            Required technologies
            <input name="requiredTechnologies" placeholder="Python, SQL" />
          </label>
          <label>
            Preferred technologies
            <input name="preferredTechnologies" placeholder="dbt, Airflow" />
          </label>
          <label>
            Excluded technologies
            <input name="excludedTechnologies" />
          </label>
          <label>
            Timezone
            <input name="timezone" defaultValue="Africa/Kigali" required />
          </label>
          <fieldset>
            <legend>Score factors (0–1)</legend>
            <label>
              Alignment
              <input name="alignment" type="number" min="0" max="1" step="0.1" defaultValue="0.4" />
            </label>
            <label>
              Growth
              <input name="growth" type="number" min="0" max="1" step="0.1" defaultValue="0.25" />
            </label>
            <label>
              Compensation
              <input
                name="compensation"
                type="number"
                min="0"
                max="1"
                step="0.1"
                defaultValue="0.2"
              />
            </label>
            <label>
              Logistics
              <input
                name="logistics"
                type="number"
                min="0"
                max="1"
                step="0.1"
                defaultValue="0.15"
              />
            </label>
          </fieldset>
          <label>
            <input name="enabled" type="checkbox" /> Enable profile
          </label>
          <button type="submit">Save profile</button>
        </form>
      </section>
      <section>
        <h2>Saved profiles</h2>
        {state === "loading" ? <p role="status">Loading profiles…</p> : null}
        {state === "error" ? <p role="alert">Could not load private search profiles.</p> : null}
        {state === "ready" && !profiles.length ? <p>No search profiles yet.</p> : null}
        <ul className="workspace-list">
          {profiles.map((profile) => (
            <li key={profile.id}>
              <strong>{profile.name}</strong>
              <p>
                {profile.target_titles.join(", ") || "No titles"} ·{" "}
                {profile.locations.join(", ") || "Any location"}
              </p>
              <p>
                {profile.required_technologies.join(", ") || "No required technologies"} ·{" "}
                {profile.timezone}
              </p>
              <details>
                <summary>Edit profile</summary>
                <form
                  className="knowledge-entry-form"
                  onSubmit={(event) => void updateProfile(event, profile)}
                >
                  <label>
                    Name
                    <input name="name" defaultValue={profile.name} required />
                  </label>
                  <label>
                    Target titles
                    <input name="targetTitles" defaultValue={profile.target_titles.join(", ")} />
                  </label>
                  <label>
                    Locations
                    <input name="locations" defaultValue={profile.locations.join(", ")} />
                  </label>
                  <label>
                    Work arrangements
                    <input
                      name="workArrangements"
                      defaultValue={profile.work_arrangements.join(", ")}
                    />
                  </label>
                  <label>
                    Employment types
                    <input
                      name="employmentTypes"
                      defaultValue={profile.employment_types.join(", ")}
                    />
                  </label>
                  <label>
                    Required technologies
                    <input
                      name="requiredTechnologies"
                      defaultValue={profile.required_technologies.join(", ")}
                    />
                  </label>
                  <label>
                    Preferred technologies
                    <input
                      name="preferredTechnologies"
                      defaultValue={profile.preferred_technologies.join(", ")}
                    />
                  </label>
                  <label>
                    Excluded technologies
                    <input
                      name="excludedTechnologies"
                      defaultValue={profile.excluded_technologies.join(", ")}
                    />
                  </label>
                  <label>
                    Timezone
                    <input name="timezone" defaultValue={profile.timezone} required />
                  </label>
                  <fieldset>
                    <legend>Score factors (0–1)</legend>
                    <label>
                      Alignment
                      <input
                        name="alignment"
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        defaultValue={profile.scoring_weights.alignment ?? 0.4}
                      />
                    </label>
                    <label>
                      Growth
                      <input
                        name="growth"
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        defaultValue={profile.scoring_weights.growth ?? 0.25}
                      />
                    </label>
                    <label>
                      Compensation
                      <input
                        name="compensation"
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        defaultValue={profile.scoring_weights.compensation ?? 0.2}
                      />
                    </label>
                    <label>
                      Logistics
                      <input
                        name="logistics"
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        defaultValue={profile.scoring_weights.logistics ?? 0.15}
                      />
                    </label>
                  </fieldset>
                  <button type="submit">Update profile</button>
                </form>
              </details>
              <div className="workspace-actions">
                <button type="button" onClick={() => void toggle(profile)}>
                  {profile.enabled ? "Disable" : "Enable"}
                </button>
                <button type="button" onClick={() => void deleteProfile(profile)}>
                  Delete profile
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      {message ? <p role="status">{message}</p> : null}
    </main>
  );
}
