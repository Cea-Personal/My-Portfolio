import { loadPublicPortfolio } from "@/lib/api/public-data";
import { ThemeToggle } from "@/components/portfolio/theme-toggle";

export const dynamic = "force-dynamic";

export default async function PublicProjectsIndex() {
  const snapshot = await loadPublicPortfolio();
  const projects = snapshot.items.filter((item) => item.source_entity_type === "project");
  return (
    <main className="project-index-page">
      <div className="project-index-toolbar">
        <p>
          <a href="/">← Back to Basil Ogbonna&apos;s portfolio</a>
        </p>
        <ThemeToggle />
      </div>
      <p className="eyebrow">Selected projects</p>
      <h1>Things I built to test an idea.</h1>
      {projects.length ? (
        <ul>
          {projects.map((project) => (
            <li key={String(project.public_id)}>
              <a
                href={`/projects/${encodeURIComponent(String(project.detail_slug || project.public_id))}`}
              >
                <strong>{String(project.title)}</strong>
              </a>
              <p>{String(project.public_summary)}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>No public projects are published yet.</p>
      )}
    </main>
  );
}
