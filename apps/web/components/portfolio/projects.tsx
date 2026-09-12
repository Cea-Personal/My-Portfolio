"use client";

import { useState } from "react";
import { PortfolioProof } from "./portfolio-proof";

const PROJECT_CATEGORIES = ["Software", "Data", "AI"] as const;

function canonicalCategory(value: string | undefined, technologies: readonly string[] = []) {
  const normalized = [value, ...technologies].filter(Boolean).join(" ").trim().toLocaleLowerCase();
  if (!normalized) return value;
  if (
    normalized.includes("ai") ||
    normalized.includes("machine learning") ||
    normalized.includes("rag")
  ) {
    return "AI";
  }
  if (
    normalized.includes("data") ||
    normalized.includes("etl") ||
    normalized.includes("pipeline") ||
    normalized.includes("warehouse") ||
    normalized.includes("airflow") ||
    normalized.includes("spark")
  ) {
    return "Data";
  }
  if (
    normalized.includes("software") ||
    normalized.includes("web") ||
    normalized.includes("application") ||
    normalized.includes("api") ||
    normalized.includes("frontend") ||
    normalized.includes("backend")
  ) {
    return "Software";
  }
  return (
    PROJECT_CATEGORIES.find((category) => category.toLocaleLowerCase() === normalized) ?? value
  );
}

export function Projects({
  items = [],
  portfolioSourceUrl
}: {
  items?: readonly {
    title: string;
    summary: string;
    href?: string;
    technologies?: string[];
    category?: string;
    meta?: string;
    image?: string;
  }[];
  portfolioSourceUrl?: string;
}) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const visibleItems =
    activeCategory === "all"
      ? items
      : items.filter(
          (item) => canonicalCategory(item.category, item.technologies ?? []) === activeCategory
        );

  return (
    <section id="projects" className="projects-section" aria-labelledby="projects-title">
      <div className="projects-index-shell">
        <header className="editorial-heading projects-heading">
          <p>Selected projects</p>
          <h2 id="projects-title">A few things I&apos;ve made curious on purpose.</h2>
          <span>
            Working systems and technical experiments, each with a public path to inspect or try it.
          </span>
        </header>
        <div className="project-category-tabs" role="tablist" aria-label="Project categories">
          <button
            className={activeCategory === "all" ? "is-active" : ""}
            type="button"
            role="tab"
            aria-selected={activeCategory === "all"}
            onClick={() => {
              setActiveCategory("all");
            }}
          >
            All projects
          </button>
          {PROJECT_CATEGORIES.map((category) => (
            <button
              className={activeCategory === category ? "is-active" : ""}
              key={category}
              type="button"
              role="tab"
              aria-selected={activeCategory === category}
              onClick={() => {
                setActiveCategory(category);
              }}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {visibleItems.length ? (
        <div className="project-showcase">
          {visibleItems.map((item, index) => {
            const category = canonicalCategory(item.category, item.technologies ?? []);
            return (
              <article
                className="project-feature"
                key={`${item.category ?? "project"}-${item.title}-${String(index)}`}
              >
                <figure className="project-feature-media">
                  {item.image ? (
                    <img src={item.image} alt={`${item.title} project cover`} loading="lazy" />
                  ) : (
                    <div className="project-feature-placeholder" aria-hidden="true">
                      <span />
                      <strong>{item.title}</strong>
                      <small>{category ?? "Engineering project"}</small>
                    </div>
                  )}
                </figure>

                <div className="project-feature-copy">
                  <p className="project-feature-kicker">
                    <span>{category ?? "Engineering"}</span>
                    <span>{item.meta ?? "Selected project"}</span>
                  </p>
                  <h3>{item.title}</h3>
                  <p className="project-feature-summary">{item.summary}</p>
                  {item.technologies?.length ? (
                    <ul className="project-feature-tools" aria-label={`${item.title} technologies`}>
                      {item.technologies.slice(0, 8).map((technology) => (
                        <li key={technology}>{technology}</li>
                      ))}
                    </ul>
                  ) : null}
                  <nav className="project-feature-links" aria-label={`${item.title} links`}>
                    {item.href ? (
                      <a className="project-feature-primary" href={item.href}>
                        View project <span aria-hidden="true">→</span>
                      </a>
                    ) : null}
                  </nav>
                </div>
              </article>
            );
          })}
        </div>
      ) : items.length ? (
        <p className="project-category-empty">No published projects in this category yet.</p>
      ) : null}

      <div className="projects-proof-shell">
        <PortfolioProof {...(portfolioSourceUrl ? { sourceUrl: portfolioSourceUrl } : {})} />
      </div>
    </section>
  );
}
