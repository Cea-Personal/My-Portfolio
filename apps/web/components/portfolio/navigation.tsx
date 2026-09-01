import { ThemeToggle } from "./theme-toggle";

export function PortfolioNavigation() {
  return (
    <nav aria-label="Portfolio sections">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <a className="brand-link" href="#hero" aria-label="Basil Ogbonna home"></a>
      <a href="#about">About</a>
      <a href="#experience">Experience</a>
      <a href="#projects">Projects</a>
      <a href="#blog">Blog</a>
      <a href="#contact">Let&apos;s talk</a>
      {/* <a className="owner-login" href="/sign-in">
        <span aria-hidden="true">◇</span> Owner login
      </a> */}
      <ThemeToggle />
    </nav>
  );
}
