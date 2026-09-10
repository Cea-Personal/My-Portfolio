"use client";

import { useState } from "react";
import { PortfolioProof } from "./portfolio-proof";

const PROJECT_CATEGORIES = [
  "Software",
  "Data",
  "AI"
] as const;

function canonicalCategory(value: string | undefined) {
  const normalized = value?.trim().toLocaleLowerCase();
  if (!normalized) return value;
  if (normalized === "software" || normalized.includes("software engineering")) {
    return normalized.includes("ai") ? "AI" : "Software";
  }
  if (normalized === "data" || normalized.includes("data platform") || normalized === "data engineering") {
    return "Data";
  }
  if (normalized.includes("ai") || normalized.includes("machine learning")) return "AI";
  return PROJECT_CATEGORIES.find((category) => category.toLocaleLowerCase() === normalized) ?? value;
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
    videoUrl?: string;
  }[];
  portfolioSourceUrl?: string;
}) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const visibleItems =
    activeCategory === "all"
      ? items
      : items.filter((item) => canonicalCategory(item.category) === activeCategory);

  return (
    <section id="projects" className="projects-section" aria-labelledby="projects-title">
      <header className="editorial-heading projects-heading">
        <p>Selected projects</p>
        <h2 id="projects-title">A few things I&apos;ve made curious on purpose.</h2>
        <span>
          Working systems and technical experiments, each with a public path to inspect or try it.
        </span>
      </header>
      <PortfolioProof {...(portfolioSourceUrl ? { sourceUrl: portfolioSourceUrl } : {})} />
      <>
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
        {visibleItems.length ? (
            <ol className="project-chapters">
              {visibleItems.map((item, index) => (
            <li className="project-chapter" key={`${item.category ?? "project"}-${item.title}-${String(index)}`}>
              <div className="project-chapter-copy">
                <span className="project-chapter-number">{String(index + 1).padStart(2, "0")}</span>
                <p className="project-chapter-type">{item.meta ?? "Personal project"}</p>
                {item.category ? <p className="project-chapter-type">{canonicalCategory(item.category)}</p> : null}
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
                    View project <span aria-hidden="true">↗</span>
                  </a>
                ) : (
                  <span className="project-chapter-link is-disabled">Preview pending</span>
                )}
              </div>
              <div
                className="project-chapter-visual"
                {...(item.videoUrl ? {} : { "aria-hidden": true })}
              >
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
        ) : items.length ? (
            <p className="project-category-empty">
              No published projects in this category yet.
            </p>
        ) : null}
      </>
    </section>
  );
}
