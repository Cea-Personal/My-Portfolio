import { PortfolioProof } from "./portfolio-proof";

export function Projects({
  items = []
}: {
  items?: readonly {
    title: string;
    summary: string;
    href?: string;
    technologies?: string[];
    meta?: string;
    image?: string;
  }[];
}) {
  return (
    <section id="projects" className="projects-section" aria-labelledby="projects-title">
      <header className="editorial-heading projects-heading">
        <p>Selected projects</p>
        <h2 id="projects-title">A few things I&apos;ve made curious on purpose.</h2>
        <span>
          Working systems and technical experiments, each with a public path to inspect or try it.
        </span>
      </header>
      <PortfolioProof />
      {items.length ? (
        <ol className="project-chapters">
          {items.map((item, index) => (
            <li className="project-chapter" key={item.title}>
              <div className="project-chapter-copy">
                <span className="project-chapter-number">{String(index + 1).padStart(2, "0")}</span>
                <p className="project-chapter-type">{item.meta ?? "Personal project"}</p>
                <h3>{item.href ? <a href={item.href}>{item.title}</a> : item.title}</h3>
                <p className="project-chapter-summary">{item.summary}</p>
                {item.technologies?.length ? (
                  <p className="project-chapter-tools">
                    {item.technologies.slice(0, 5).join(" · ")}
                  </p>
                ) : null}
                {item.href ? (
                  <a
                    className="project-chapter-link"
                    href={item.href}
                    aria-label={`Open ${item.title}`}
                  >
                    Experience project <span aria-hidden="true">↗</span>
                  </a>
                ) : (
                  <span className="project-chapter-link is-disabled">Preview pending</span>
                )}
              </div>
              <div className="project-chapter-visual" aria-hidden="true">
                {item.image ? (
                  <span
                    className="project-chapter-image"
                    style={{ backgroundImage: `url(${JSON.stringify(item.image)})` }}
                  />
                ) : (
                  <>
                    <span className="project-chapter-grid" />
                    <span className="project-chapter-orbit" />
                    <span className="project-chapter-signal" />
                    <small>project.system / {String(index + 1).padStart(2, "0")}</small>
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
