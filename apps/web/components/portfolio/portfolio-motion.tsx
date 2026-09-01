"use client";

import { useEffect } from "react";

export function PortfolioMotion() {
  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".portfolio-stream > section:not(.hero-section), .portfolio-stream > .intelligence-grid"
      )
    );

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sections.forEach((section) => {
        section.dataset.reveal = "visible";
      });
      return;
    }

    sections.forEach((section) => {
      section.dataset.reveal = "pending";
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          (entry.target as HTMLElement).dataset.reveal = "visible";
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -10%", threshold: 0.08 }
    );

    sections.forEach((section) => {
      observer.observe(section);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return null;
}
