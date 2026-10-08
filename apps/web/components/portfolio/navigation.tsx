"use client";

import { useState } from "react";
import { ThemeToggle } from "./theme-toggle";

export function PortfolioNavigation({ showBlog = false }: { showBlog?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => {
    setMenuOpen(false);
  };

  return (
    <nav aria-label="Portfolio sections">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <a className="brand-link" href="#hero" aria-label="Basil Ogbonna home"></a>
      <button
        className="mobile-nav-toggle"
        type="button"
        aria-label="Toggle portfolio navigation"
        aria-expanded={menuOpen}
        aria-controls="portfolio-mobile-menu"
        onClick={() => {
          setMenuOpen((open) => !open);
        }}
      >
        <span aria-hidden="true">☰</span> Menu
      </button>
      <div
        id="portfolio-mobile-menu"
        className={menuOpen ? "portfolio-nav-links is-open" : "portfolio-nav-links"}
      >
        <a href="#experience" onClick={closeMenu}>
          Experience
        </a>
        <a href="#projects" onClick={closeMenu}>
          Projects
        </a>
        <a href="#about" onClick={closeMenu}>
          About
        </a>
        <a href="#ask" onClick={closeMenu}>
          Ask Basil
        </a>
        {showBlog ? (
          <a href="#blog" onClick={closeMenu}>
            Blog
          </a>
        ) : null}
        <a href="#contact" onClick={closeMenu}>
          Let&apos;s talk
        </a>
        <a className="owner-login" href="/sign-in" onClick={closeMenu}>
          <span aria-hidden="true">◇</span> Owner login
        </a>
        <ThemeToggle />
      </div>
    </nav>
  );
}
