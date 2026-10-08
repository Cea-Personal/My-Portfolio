const essentials = [
  [
    "Search profiles",
    "/settings/search-profiles",
    "Set the roles, locations, and work arrangements you want to pursue."
  ],
  [
    "Scheduled job search",
    "/settings/automations",
    "Keep relevant opportunities arriving on your schedule."
  ],
  [
    "Documents",
    "/settings/documents",
    "Upload career evidence or sync your selected Google Drive folder."
  ]
] as const;

const administration = [
  [
    "Analytics",
    "/settings/analytics",
    "Review portfolio engagement, application progress, and interview outcomes."
  ],
  [
    "AI providers",
    "/settings/providers",
    "Manage model connections and server-side credential references."
  ],
  [
    "Agents",
    "/settings/agents",
    "Configure and verify the existing orchestrator, retrieval, and image models."
  ],
  [
    "Job sources",
    "/settings/job-sources",
    "Configure and troubleshoot your existing discovery sources."
  ],
  ["Automation history", "/settings/automations", "Inspect runs, retries, and failed events."],
  ["Logs", "/settings/logs", "Investigate system errors and AI execution diagnostics."],
  ["Data and exports", "/settings/data", "Request an export of your private workspace data."]
] as const;

function SettingsLinks({ areas }: { areas: readonly (readonly [string, string, string])[] }) {
  return (
    <ul className="workspace-list settings-links">
      {areas.map(([label, href, description]) => (
        <li key={label}>
          <a href={href}>
            <strong>{label}</strong>
          </a>
          <p>{description}</p>
        </li>
      ))}
    </ul>
  );
}

export default function SettingsPage() {
  return (
    <main className="workspace-page settings-page">
      <header className="workspace-heading">
        <p className="eyebrow">Workspace setup</p>
        <h1>Settings / Admin</h1>
        <p>Set your search preferences and keep your career evidence current.</p>
      </header>
      <section aria-labelledby="settings-essentials">
        <h2 id="settings-essentials">Search and evidence</h2>
        <SettingsLinks areas={essentials} />
      </section>
      <details className="workspace-disclosure settings-administration">
        <summary>Advanced administration</summary>
        <p>Model setup, diagnostics, and reporting are here when you need them.</p>
        <SettingsLinks areas={administration} />
      </details>
    </main>
  );
}
