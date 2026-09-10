"use client";

import { useState } from "react";

export interface CareerTimelineProject {
  title: string;
  summary: string;
  href?: string;
}

export interface CareerTimelineStage {
  title: string;
  summary: string;
  company?: string;
  period?: string;
  projects?: readonly CareerTimelineProject[];
  experience?: readonly string[];
  /** Legacy published shape; retained so older publications still render. */
  impacts?: readonly string[];
  skills?: readonly string[];
}

export function CareerTimeline({ stages = [] }: { stages?: readonly CareerTimelineStage[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="experience" className="experience-section" aria-labelledby="career-title">
      <span id="career" aria-hidden="true" />
      <header className="editorial-heading">
        <p>Experience</p>
        <h2 id="career-title">The journey, company by company.</h2>
        <span>A brief of every chapter is always visible. Open one to see the work behind it.</span>
      </header>
      {stages.length ? (
        <ol className="career-accordion" aria-label="Career chapters">
          {stages.map((stage, index) => (
            <li key={`${stage.title}-${String(index)}`}>
              <button
                type="button"
                className={index === openIndex ? "is-open" : undefined}
                aria-expanded={index === openIndex}
                aria-controls={`career-detail-${String(index)}`}
                onClick={() => {
                  setOpenIndex((current) => (current === index ? null : index));
                }}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{stage.title}</strong>
                <small>{stage.company ?? stage.period ?? "Career chapter"}</small>
                <em>{stage.summary}</em>
                <i aria-hidden="true">+</i>
              </button>
              {index === openIndex ? (
                <article id={`career-detail-${String(index)}`} className="career-accordion-detail">
                  <div className="career-detail-intro">
                    <p>{stage.period ?? `Chapter ${String(index + 1).padStart(2, "0")}`}</p>
                    <h3>{stage.title}</h3>
                    {stage.company ? <strong>{stage.company}</strong> : null}
                  </div>
                  <div className="career-unfold">
                    <section className="career-unfold-panel career-work">
                      <h4>Selected work</h4>
                      {stage.projects?.length ? (
                        <ul>
                          {stage.projects.map((project) => (
                            <li key={project.title}>
                              {project.href ? (
                                <a href={project.href}>{project.title}</a>
                              ) : (
                                project.title
                              )}
                              <p>{project.summary}</p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="career-detail-empty">Published work will appear here.</p>
                      )}
                    </section>
                    <section className="career-unfold-panel career-impact">
                      <h4>Experience</h4>
                      {stage.experience?.length || stage.impacts?.length ? (
                        <ul>
                          {(stage.experience ?? stage.impacts ?? []).map((detail) => (
                            <li key={detail}>{detail}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="career-detail-empty">
                          Verified experience details will appear here.
                        </p>
                      )}
                    </section>
                    <section className="career-unfold-panel career-tools role-toolkit">
                      <h4>Skills &amp; tools</h4>
                      {stage.skills?.length ? (
                        <ul>
                          {stage.skills.map((skill) => (
                            <li key={skill}>{skill}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="career-detail-empty">
                          Published skills and tools will appear here.
                        </p>
                      )}
                    </section>
                  </div>
                </article>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p>Approved experience will appear here as your career profile is published.</p>
      )}
    </section>
  );
}
