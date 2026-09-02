"use client";

import { useEffect, useState } from "react";

interface HeroRole {
  label: string;
  core: string;
  leading?: string;
  middle?: string;
}

const roles: readonly HeroRole[] = [
  { label: "Data Engineer", core: "Data" },
  { label: "Data Platform Engineer", core: "Data", middle: "Platform" },
  { label: "AI Data Engineer", leading: "AI", core: "Data" },
  { label: "AI Engineer", core: "AI" },
  { label: "AI Software Engineer", leading: "AI", core: "Software" },
  { label: "Software Engineer", core: "Software" }
] as const;

const career = [
  "Web Developer",
  "Software Engineer",
  "Lead Software Engineer",
  "Data Engineer",
  "Senior Data Engineer",
  "AI Engineer"
] as const;

export function Hero({ name = "Basil Ogbonna" }: { name?: string; headline?: string }) {
  const [roleIndex, setRoleIndex] = useState(0);
  const firstName = name.split(" ")[0] ?? name;
  const role = roles[roleIndex] ?? roles[0];

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) {
      setRoleIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setRoleIndex((current) => (current + 1) % roles.length);
    }, 3800);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section id="hero" className="hero-section cinematic-hero" aria-labelledby="hero-title">
      <div className="hero-signal-field" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <i />
      </div>
      <div className="cinematic-hero-content">
        <p className="hero-name">Basil Ogbonna</p>
        <h1 id="hero-title">
          <span className="sr-only" aria-live="polite">
            {role.label}
          </span>
          <span className="hero-evolving-role" aria-hidden="true">
            {role.leading ? (
              <strong className="hero-role-token" key={`leading-${role.leading}`}>
                {role.leading}
              </strong>
            ) : null}
            <strong className="hero-role-token" key={`core-${role.core}`}>
              {role.core}
            </strong>
            {role.middle ? (
              <strong className="hero-role-token" key={`middle-${role.middle}`}>
                {role.middle}
              </strong>
            ) : null}
            <strong className="hero-engineer-role">Engineer</strong>
          </span>
        </h1>
        <div className="hero-actions" aria-label="Portfolio actions">
          <a className="button-link" href="#projects">
            See the work <span aria-hidden="true">↓</span>
          </a>
          <a className="text-link" href="#blog">
            Read the blog <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
      <a
        className="hero-career-link"
        href="#experience"
        aria-label={`Explore ${firstName}'s career journey`}
      >
        <span>Career signal</span>
        <span className="hero-career-track">
          {career.map((stage, index) => (
            <span key={stage}>
              <small>{String(index + 1).padStart(2, "0")}</small>
              {stage}
            </span>
          ))}
        </span>
      </a>
    </section>
  );
}
