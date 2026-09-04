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
  const media = Array.isArray(project.sanitized_media)
    ? project.sanitized_media.filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === "object")
      )
    : [];
  const citations = Array.isArray(project.public_citations)
    ? project.public_citations.filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === "object")
      )
    : [];
  return (
    <main className="project-detail-page">
      <p>
        <a href="/#projects">← Back to selected projects</a>
      </p>
      {snapshot.stale ? (
        <p className="portfolio-stale-notice" role="status">
          Showing the latest approved project snapshot while live content reconnects.
        </p>
      ) : null}
      <h1>{typeof project.title === "string" ? project.title : "Project"}</h1>
      {typeof project.subtitle === "string" ? <p>{project.subtitle}</p> : null}
      <p>{typeof project.public_summary === "string" ? project.public_summary : ""}</p>
      {typeof project.display_metric === "string" ? <p>{project.display_metric}</p> : null}
      {Array.isArray(project.display_technologies) && project.display_technologies.length ? (
        <section aria-labelledby="project-tools">
          <h2 id="project-tools">Tools and technologies</h2>
          <ul>
            {project.display_technologies.map((technology) => (
              <li key={String(technology)}>{String(technology)}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {media.length ? (
        <section aria-labelledby="project-links">
          <h2 id="project-links">Explore the work</h2>
          <ul>
            {media.map((item, index) => {
              const url =
                typeof item.url === "string"
                  ? item.url
                  : typeof item.href === "string"
                    ? item.href
                    : null;
              const label =
                typeof item.label === "string" ? item.label : `Project link ${String(index + 1)}`;
              return url ? (
                <li key={`${url}-${String(index)}`}>
                  <a href={url} rel="noreferrer">
                    {label} ↗
                  </a>
                </li>
              ) : null;
            })}
          </ul>
        </section>
      ) : null}
      {citations.length ? (
        <section aria-labelledby="project-evidence">
          <h2 id="project-evidence">Evidence and contribution</h2>
          <ul>
            {citations.map((item, index) => (
              <li
                key={
                  typeof item.public_evidence_id === "string"
                    ? item.public_evidence_id
                    : `evidence-${String(index)}`
                }
              >
                Approved public evidence reference
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
