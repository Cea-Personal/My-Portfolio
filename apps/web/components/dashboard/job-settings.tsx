"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { WorkspaceToast } from "@/components/ui/workspace-toast";

interface SourceConfig {
  endpoint?: string;
  secret_ref?: string | null;
  rate_limit_per_minute?: number;
  last_test_outcome?: string | null;
  discovery_frequency_minutes?: number;
  schedule_eligible?: boolean;
  extraction_config?: Record<string, string>;
}

interface JobSource {
  id: string;
  name: string;
  adapter_type: string;
  adapter_version: string;
  enabled: boolean;
  health_status: string;
  last_run_at?: string | null;
  last_success_at?: string | null;
  last_failure_at?: string | null;
  consecutive_failures?: number;
  last_discovered_count?: number;
  last_accepted_count?: number;
  job_source_configs?: SourceConfig[] | SourceConfig;
}

interface SearchProfile {
  id: string;
  name: string;
  enabled: boolean;
  target_titles: string[];
  seniority_levels: string[];
  locations: string[];
  work_arrangements: string[];
  employment_types: string[];
  required_technologies: string[];
  excluded_technologies: string[];
  industries: string[];
  company_sizes: string[];
  excluded_companies: string[];
  visa_sponsorship?: string | null;
  relocation_support?: string | null;
  language_requirements: string[];
  minimum_salary?: number | null;
  preferred_salary?: number | null;
  salary_currency?: string | null;
  max_job_age_days: number;
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

function extractionConfig(form: FormData): Record<string, string> {
  return Object.fromEntries(
    [
      "jobSelector",
      "titleSelector",
      "companySelector",
      "locationSelector",
      "urlSelector",
      "nextPageSelector"
    ]
      .map((name) => {
        const value = form.get(name);
        return [name, typeof value === "string" ? value.trim() : ""] as const;
      })
      .filter(([, value]) => value)
  );
}

function profileCriteria(form: FormData) {
  return {
    targetTitles: list(form.get("targetTitles")),
    seniorityLevels: list(form.get("seniorityLevels")),
    locations: list(form.get("locations")),
    workArrangements: list(form.get("workArrangements")),
    employmentTypes: list(form.get("employmentTypes")),
    requiredTechnologies: list(form.get("requiredTechnologies")),
    excludedTechnologies: list(form.get("excludedTechnologies")),
    industries: list(form.get("industries")),
    companySizes: list(form.get("companySizes")),
    excludedCompanies: list(form.get("excludedCompanies")),
    visaSponsorship: form.get("visaSponsorship"),
    relocationSupport: form.get("relocationSupport"),
    languageRequirements: list(form.get("languageRequirements")),
    minimumSalary: form.get("minimumSalary"),
    preferredSalary: form.get("preferredSalary"),
    salaryCurrency: form.get("salaryCurrency"),
    maxJobAgeDays: Number(form.get("maxJobAgeDays"))
  };
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
    const target = event.currentTarget;
    const form = new FormData(target);
    try {
      await request("/api/v1/job-sources", "POST", {
        name: form.get("name"),
        adapterType: form.get("adapterType"),
        endpoint: form.get("endpoint"),
        secretRef: form.get("secretRef"),
        rateLimitPerMinute: Number(form.get("rateLimit")),
        discoveryFrequencyMinutes: Number(form.get("frequency")),
        scheduleEligible: form.get("scheduleEligible") === "on",
        extractionConfig: extractionConfig(form),
        termsNote: form.get("termsNote"),
        enabled: form.get("enabled") === "on"
      });
      target.reset();
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
        discoveryFrequencyMinutes: Number(form.get("frequency")),
        scheduleEligible: form.get("scheduleEligible") === "on",
        extractionConfig: extractionConfig(form),
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

  async function remove(source: JobSource) {
    if (!window.confirm(`Disable and remove “${source.name}” from future searches?`)) return;
    setMessage(`Removing ${source.name}…`);
    try {
      await request(`/api/v1/job-sources/${source.id}`, "DELETE");
      setMessage(`${source.name} was removed from future searches.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove source.");
    }
  }

  return (
    <main className="workspace-page">
      <header className="workspace-heading">
        <p className="eyebrow">Opportunity intake</p>
        <h1>Job sources</h1>
        <p>
          Configure, test, schedule, and monitor approved sources. Credentials remain server-side;
          only their environment-variable name is stored.
        </p>
        <p>
          <a href="/jobs">Run enabled sources from the Jobs workspace →</a>
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
              <option value="workable">Workable</option>
              <option value="smartrecruiters">SmartRecruiters</option>
              <option value="teamtailor">Teamtailor</option>
              <option value="personio">Personio</option>
              <option value="recruitee">Recruitee</option>
              <option value="jobgether">Jobgether (public API)</option>
              <option value="remoteok">Remote OK (public JSON feed)</option>
              <option value="arbeitnow">Arbeitnow (public API)</option>
              <option value="adzuna">Adzuna API</option>
              <option value="jsearch">JSearch (RapidAPI)</option>
              <option value="flybyapis">FlyByAPIs Jobs (RapidAPI)</option>
              <option value="serpapi">SerpApi Google Jobs</option>
              <option value="theirstack">TheirStack Jobs API</option>
              <option value="jobspipe">JobsPipe API</option>
              <option value="structured">Structured data (JSON-LD)</option>
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
              placeholder="https://boards-api.greenhouse.io/v1/boards/company/jobs"
            />
          </label>
          <p>
            No-key presets: Jobgether, Remote OK, and Arbeitnow. Keyed providers read only the
            environment-variable name entered below; the secret itself never enters the database.
            Defaults are available for Adzuna, JSearch, FlyByAPIs, SerpApi, TheirStack, and JobsPipe.
          </p>
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
            <small>
              Enter a variable name, never an API key. Suggested names: ADZUNA_APP_KEY,
              JSEARCH_RAPIDAPI_KEY, FLYBYAPIS_RAPIDAPI_KEY, SERPAPI_API_KEY, THEIRSTACK_API_KEY, or
              JOBSPIPE_API_KEY.
            </small>
          </label>
          <label>
            Rate limit per minute
            <input name="rateLimit" type="number" min="1" max="300" defaultValue="30" required />
          </label>
          <label>
            Discovery frequency (minutes)
            <input
              name="frequency"
              type="number"
              min="15"
              max="43200"
              defaultValue="1440"
              required
            />
          </label>
          <details>
            <summary>HTML / structured extraction selectors</summary>
            <p>Optional, reviewed CSS selectors for sources without a supported ATS feed.</p>
            <label>
              Job item selector
              <input name="jobSelector" placeholder="article.job" />
            </label>
            <label>
              Title selector
              <input name="titleSelector" placeholder="h2" />
            </label>
            <label>
              Company selector
              <input name="companySelector" placeholder=".company" />
            </label>
            <label>
              Location selector
              <input name="locationSelector" placeholder=".location" />
            </label>
            <label>
              Job URL selector
              <input name="urlSelector" placeholder="a.apply" />
            </label>
            <label>
              Next-page selector
              <input name="nextPageSelector" placeholder="a.next" />
            </label>
          </details>
          <label>
            Terms / lawful-use note
            <textarea name="termsNote" rows={3} maxLength={1000} />
          </label>
          <label>
            <input name="enabled" type="checkbox" /> Enable after saving
          </label>
          <label>
            <input name="scheduleEligible" type="checkbox" /> Include in scheduled discovery
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
                <p>
                  Every {String(config.discovery_frequency_minutes ?? 1440)} minutes · last run:{" "}
                  {source.last_run_at ? new Date(source.last_run_at).toLocaleString() : "never"} ·
                  last yield: {String(source.last_accepted_count ?? 0)}/
                  {String(source.last_discovered_count ?? 0)} accepted
                </p>
                {source.last_failure_at ? (
                  <p>
                    Last failure: {new Date(source.last_failure_at).toLocaleString()} · consecutive
                    failures: {String(source.consecutive_failures ?? 0)}
                  </p>
                ) : null}
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
                      Discovery frequency (minutes)
                      <input
                        name="frequency"
                        type="number"
                        min="15"
                        max="43200"
                        defaultValue={config.discovery_frequency_minutes ?? 1440}
                      />
                    </label>
                    <details>
                      <summary>Edit extraction selectors</summary>
                      <label>
                        Job item selector
                        <input
                          name="jobSelector"
                          defaultValue={config.extraction_config?.jobSelector ?? ""}
                        />
                      </label>
                      <label>
                        Title selector
                        <input
                          name="titleSelector"
                          defaultValue={config.extraction_config?.titleSelector ?? ""}
                        />
                      </label>
                      <label>
                        Company selector
                        <input
                          name="companySelector"
                          defaultValue={config.extraction_config?.companySelector ?? ""}
                        />
                      </label>
                      <label>
                        Location selector
                        <input
                          name="locationSelector"
                          defaultValue={config.extraction_config?.locationSelector ?? ""}
                        />
                      </label>
                      <label>
                        Job URL selector
                        <input
                          name="urlSelector"
                          defaultValue={config.extraction_config?.urlSelector ?? ""}
                        />
                      </label>
                      <label>
                        Next-page selector
                        <input
                          name="nextPageSelector"
                          defaultValue={config.extraction_config?.nextPageSelector ?? ""}
                        />
                      </label>
                    </details>
                    <label>
                      <input
                        name="scheduleEligible"
                        type="checkbox"
                        defaultChecked={config.schedule_eligible}
                      />{" "}
                      Include in scheduled discovery
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
                  <button type="button" onClick={() => void remove(source)}>
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
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
    const target = event.currentTarget;
    const form = new FormData(target);
    try {
      await request("/api/v1/search-profiles", "POST", {
        name: form.get("name"),
        ...profileCriteria(form),
        timezone: form.get("timezone"),
        enabled: form.get("enabled") === "on"
      });
      target.reset();
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
        ...profileCriteria(form),
        timezone: form.get("timezone")
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
        <p className="workspace-note">
          Matching and opportunity ranking are calculated automatically from these criteria; there
          are no manual score factors to maintain.
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
            Seniority levels
            <input name="seniorityLevels" placeholder="senior, staff, lead" />
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
            Technologies
            <input name="requiredTechnologies" placeholder="Python, SQL, dbt, Airflow, Kafka" />
          </label>
          <label>
            Excluded technologies
            <input name="excludedTechnologies" />
          </label>
          <label>
            Industries
            <input name="industries" placeholder="fintech, healthtech" />
          </label>
          <label>
            Company sizes
            <input name="companySizes" placeholder="startup, scale-up, enterprise" />
          </label>
          <label>
            Excluded companies
            <input name="excludedCompanies" />
          </label>
          <label>
            Visa sponsorship requirement
            <input name="visaSponsorship" placeholder="required, preferred, not needed" />
          </label>
          <label>
            Relocation support
            <input name="relocationSupport" placeholder="required, optional" />
          </label>
          <label>
            Language requirements
            <input name="languageRequirements" placeholder="English" />
          </label>
          <fieldset>
            <legend>Compensation and freshness</legend>
            <label>
              Minimum salary
              <input name="minimumSalary" type="number" min="0" />
            </label>
            <label>
              Preferred salary
              <input name="preferredSalary" type="number" min="0" />
            </label>
            <label>
              Currency
              <input name="salaryCurrency" maxLength={3} placeholder="USD" />
            </label>
            <label>
              Maximum job age (days)
              <input
                name="maxJobAgeDays"
                type="number"
                min="1"
                max="365"
                defaultValue="30"
                required
              />
            </label>
          </fieldset>
          <label>
            Timezone
            <input name="timezone" defaultValue="Africa/Kigali" required />
          </label>
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
                    Seniority levels
                    <input
                      name="seniorityLevels"
                      defaultValue={profile.seniority_levels.join(", ")}
                    />
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
                    Technologies
                    <input
                      name="requiredTechnologies"
                      defaultValue={profile.required_technologies.join(", ")}
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
                    Industries
                    <input name="industries" defaultValue={profile.industries.join(", ")} />
                  </label>
                  <label>
                    Company sizes
                    <input name="companySizes" defaultValue={profile.company_sizes.join(", ")} />
                  </label>
                  <label>
                    Excluded companies
                    <input
                      name="excludedCompanies"
                      defaultValue={profile.excluded_companies.join(", ")}
                    />
                  </label>
                  <label>
                    Visa sponsorship requirement
                    <input name="visaSponsorship" defaultValue={profile.visa_sponsorship ?? ""} />
                  </label>
                  <label>
                    Relocation support
                    <input
                      name="relocationSupport"
                      defaultValue={profile.relocation_support ?? ""}
                    />
                  </label>
                  <label>
                    Language requirements
                    <input
                      name="languageRequirements"
                      defaultValue={profile.language_requirements.join(", ")}
                    />
                  </label>
                  <fieldset>
                    <legend>Compensation and freshness</legend>
                    <label>
                      Minimum salary
                      <input
                        name="minimumSalary"
                        type="number"
                        min="0"
                        defaultValue={profile.minimum_salary ?? ""}
                      />
                    </label>
                    <label>
                      Preferred salary
                      <input
                        name="preferredSalary"
                        type="number"
                        min="0"
                        defaultValue={profile.preferred_salary ?? ""}
                      />
                    </label>
                    <label>
                      Currency
                      <input
                        name="salaryCurrency"
                        maxLength={3}
                        defaultValue={profile.salary_currency ?? ""}
                      />
                    </label>
                    <label>
                      Maximum job age (days)
                      <input
                        name="maxJobAgeDays"
                        type="number"
                        min="1"
                        max="365"
                        defaultValue={profile.max_job_age_days}
                        required
                      />
                    </label>
                  </fieldset>
                  <label>
                    Timezone
                    <input name="timezone" defaultValue={profile.timezone} required />
                  </label>
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
      <WorkspaceToast
        message={message}
        onDismiss={() => {
          setMessage("");
        }}
      />
    </main>
  );
}
