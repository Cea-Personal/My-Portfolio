import { loadPublicPortfolio } from "@/lib/api/public-data";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const snapshot = await loadPublicPortfolio();
  const project = snapshot.items.find(
    (item) => item.source_entity_type === "project" && item.detail_slug === slug
  );
  if (!project) {
    return (
      <main>
        <h1>Project unavailable</h1>
        <p>This project is not part of the active public projection.</p>
      </main>
    );
  }
  return (
    <main>
      <h1>{typeof project.title === "string" ? project.title : "Project"}</h1>
      {typeof project.subtitle === "string" ? <p>{project.subtitle}</p> : null}
      <p>{typeof project.public_summary === "string" ? project.public_summary : ""}</p>
      {typeof project.display_metric === "string" ? <p>{project.display_metric}</p> : null}
      {Array.isArray(project.display_technologies) && project.display_technologies.length ? (
        <ul>
          {project.display_technologies.map((technology) => (
            <li key={String(technology)}>{String(technology)}</li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
