import { loadPublicPortfolio } from "@/lib/api/public-data";
import { expandTechnologyLabels, expandTechnologyTerms } from "@/lib/portfolio-career-rules";
import { projectYoutubeEmbedUrl, youtubeEmbedUrl } from "@/lib/portfolio-media";
import { ThemeToggle } from "@/components/portfolio/theme-toggle";

export const dynamic = "force-dynamic";

const text = (value: unknown, fallback = "") =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
    : [];

function safeExternalUrl(value: unknown): string {
  const candidate = text(value);
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function firstImage(media: unknown): { url: string; alt: string } | null {
  if (!Array.isArray(media)) return null;
  for (const item of media) {
    const itemRecord = record(item);
    const value = typeof item === "string" ? item : (itemRecord.url ?? itemRecord.src);
    const url = safeExternalUrl(value);
    if (!url || youtubeEmbedUrl(url)) continue;
    return { url, alt: text(itemRecord.alt, "Project cover image") };
  }
  return null;
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let projectSlug = slug;
  try {
    projectSlug = decodeURIComponent(slug);
  } catch {
    // Keep the original route segment if a malformed escape reaches the page;
    // it will safely fall through to the unavailable state below.
  }
  const snapshot = await loadPublicPortfolio();
  const project = snapshot.items.find(
    (item) =>
      item.source_entity_type === "project" &&
      (item.detail_slug === projectSlug || item.public_id === projectSlug)
  );
  if (!project) {
    return (
      <main className="project-detail-page">
        <h1>Project unavailable</h1>
        <p>This project is not part of the active public projection.</p>
      </main>
    );
  }

  const structured = record(project.structured_content);
  const displayText = (value: unknown, fallback = "") =>
    expandTechnologyTerms(text(value, fallback));
  const title = displayText(project.title, "Project");
  const summary = displayText(
    project.public_summary,
    displayText(structured.summary, "A selected project.")
  );
  const description = displayText(structured.description, summary);
  const problem = displayText(structured.problem);
  const approach = displayText(structured.approach);
  const role = displayText(structured.role, text(project.subtitle));
  const outcome = displayText(structured.outcome);
  const points = Array.from(
    new Set([
      ...strings(structured.highlights),
      ...strings(structured.points),
      ...strings(structured.experience),
      ...strings(structured.outcomes)
    ])
  )
    .map(expandTechnologyTerms)
    .slice(0, 12);
  const process = strings(structured.process).map(expandTechnologyTerms).slice(0, 12);
  const technologies = expandTechnologyLabels(
    Array.from(
      new Set([...strings(project.display_technologies), ...strings(structured.technologies)])
    )
  );
  const videoUrl = projectYoutubeEmbedUrl(project.sanitized_media, project.structured_content);
  const coverImage = firstImage(project.sanitized_media);
  const links = [
    { label: "Live project", url: safeExternalUrl(structured.liveUrl) },
    { label: "GitHub repository", url: safeExternalUrl(structured.githubUrl) },
    { label: "Project link", url: safeExternalUrl(structured.url ?? structured.link) }
  ].filter(
    (link, index, all) =>
      Boolean(link.url) && all.findIndex((candidate) => candidate.url === link.url) === index
  );
  const videoWithAutoplay = videoUrl
    ? `${videoUrl}${videoUrl.includes("?") ? "&" : "?"}autoplay=1&mute=1`
    : null;

  return (
    <main className="project-detail-page">
      <div className="project-detail-toolbar">
        <p className="project-detail-back">
          <a href="/#projects">← Back to selected projects</a>
        </p>
        <ThemeToggle />
      </div>
      {snapshot.stale ? (
        <p className="portfolio-stale-notice" role="status">
          Showing the latest approved project snapshot while live content reconnects.
        </p>
      ) : null}

      <header className="project-detail-hero">
        {videoWithAutoplay ? (
          <div className="project-detail-hero-video">
            <iframe
              src={videoWithAutoplay}
              title={`${title} project demonstration`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : coverImage ? (
          <figure className="project-detail-hero-image">
            <img src={coverImage.url} alt={coverImage.alt || `${title} cover`} />
          </figure>
        ) : null}
        <div className="project-detail-hero-copy">
          <p className="eyebrow">{text(project.career_stage, "Selected project")}</p>
          <h1>{title}</h1>
          {role ? <p className="project-detail-role">{role}</p> : null}
          <p className="project-detail-summary">{summary}</p>
          {links.length ? (
            <nav className="project-detail-links" aria-label="Project links">
              {links.map((link) => (
                <a key={link.url} href={link.url} rel="noreferrer" target="_blank">
                  {link.label} <span aria-hidden="true">↗</span>
                </a>
              ))}
            </nav>
          ) : null}
        </div>
      </header>

      <div className="project-detail-sections">
        <section
          className="project-detail-section project-detail-overview"
          aria-labelledby="project-overview"
        >
          <p className="eyebrow">The work</p>
          <h2 id="project-overview">What this project set out to solve.</h2>
          <p>{description}</p>
          {problem ? (
            <div>
              <h3>The problem</h3>
              <p>{problem}</p>
            </div>
          ) : null}
          {approach ? (
            <div>
              <h3>The approach</h3>
              <p>{approach}</p>
            </div>
          ) : null}
          {outcome ? (
            <div>
              <h3>Outcome</h3>
              <p>{outcome}</p>
            </div>
          ) : null}
        </section>

        {points.length ? (
          <section className="project-detail-section" aria-labelledby="project-points">
            <p className="eyebrow">Project notes</p>
            <h2 id="project-points">The decisions and results worth remembering.</h2>
            <ul className="project-detail-list">
              {points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {process.length ? (
          <section className="project-detail-section" aria-labelledby="project-process">
            <p className="eyebrow">How it was built</p>
            <h2 id="project-process">From first constraint to working system.</h2>
            <ol className="project-detail-process">
              {process.map((step) => (
                <li key={step}>
                  <p>{step}</p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {technologies.length ? (
          <section className="project-detail-section" aria-labelledby="project-skills">
            <p className="eyebrow">Skills and tools</p>
            <h2 id="project-skills">The technical choices behind it.</h2>
            <ul className="project-detail-tools">
              {technologies.map((technology) => (
                <li key={technology}>{technology}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}
