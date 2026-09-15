"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem("basil-portfolio-theme");
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.portfolioTheme = theme;
    window.localStorage.setItem("basil-portfolio-theme", theme);
  }, [theme]);

  useEffect(() => {
    return () => {
      // Do not leak the public portfolio theme attribute into the private
      // workspace when navigating between route groups client-side.
      delete document.documentElement.dataset.portfolioTheme;
    };
  }, []);

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={`Switch to ${nextTheme} mode`}
      onClick={() => {
        setTheme(nextTheme);
      }}
    >
      <span aria-hidden="true">{theme === "dark" ? "☼" : "◐"}</span>
      <small>{theme}</small>
    </button>
  );
}
