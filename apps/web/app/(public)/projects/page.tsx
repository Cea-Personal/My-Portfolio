import { loadPublicPortfolio } from "@/lib/api/public-data";

export const dynamic = "force-dynamic";

export default async function PublicProjectsIndex() {
  const snapshot = await loadPublicPortfolio();
  const projects = snapshot.items.filter(
    (item) => item.source_entity_type === "project" && typeof item.detail_slug === "string"
  );
  return (
    <main className="project-index-page">
      <p>
        <a href="/">← Back to Basil Ogbonna&apos;s portfolio</a>
      </p>
      <p className="eyebrow">Selected projects</p>
      <h1>Things I built to test an idea.</h1>
      {projects.length ? (
        <ul>
          {projects.map((project) => (
            <li key={String(project.public_id)}>
              <a href={`/projects/${String(project.detail_slug)}`}>
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
