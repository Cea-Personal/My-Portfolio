const settingsAreas = [
  [
    "Documents",
    "/settings/documents",
    "Upload and reprocess private CVs, cover letters, and source files."
  ],
  [
    "Analytics",
    "/settings/analytics",
    "Review private portfolio, application, interview, and career-gap signals."
  ],
  ["Agents", "/settings/agents", "Inspect bounded AI capabilities and owner-approved actions."],
  [
    "Automations",
    "/settings/automations",
    "Configure schedules, retries, and durable workflow runs."
  ],
  [
    "Search profiles",
    "/settings/search-profiles",
    "Choose role, location, technology, and scoring preferences."
  ],
  [
    "Job sources",
    "/settings/job-sources",
    "Connect lawful feeds and run sanitized source health checks."
  ],
  ["AI providers", "/settings/providers", "Configure task-level models without exposing secrets."],
  ["Data and exports", "/settings/data", "Request private exports and manage portability."]
] as const;

export default function SettingsPage() {
  return (
    <main className="workspace-page">
      <header className="workspace-heading">
        <p className="eyebrow">Workspace configuration</p>
        <h1>Settings</h1>
        <p>
          Everything that configures Career Brain, discovery, automation, and private data lives
          here.
        </p>
      </header>
      <section aria-labelledby="settings-areas">
        <h2 id="settings-areas">Manage your workspace</h2>
        <ul className="workspace-list">
          {settingsAreas.map(([label, href, description]) => (
            <li key={href}>
              <a href={href}>
                <strong>{label}</strong>
              </a>
              <p>{description}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
