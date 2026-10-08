interface HeroLink {
  label: string;
  href?: string;
}

export function Hero({
  name = "Basil Ogbonna",
  headline = "Senior Data Engineer",
  statement,
  links = [],
  showBlog = false
}: {
  name?: string;
  headline?: string;
  statement?: string;
  links?: readonly HeroLink[];
  showBlog?: boolean;
}) {
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
        <p className="hero-name">{name}</p>
        <h1 id="hero-title">{headline}</h1>
        {statement ? <p className="hero-value-statement">{statement}</p> : null}
        <div className="hero-actions" aria-label="Portfolio actions">
          <a className="button-link" href="#projects">
            See the work <span aria-hidden="true">↓</span>
          </a>
          <a className="text-link" href="#contact">
            Let&apos;s talk <span aria-hidden="true">↗</span>
          </a>
          {showBlog ? (
            <a className="text-link" href="#blog">
              Read the blog
            </a>
          ) : null}
        </div>
      </div>
      <div className="hero-profile-footer">
        <p className="profile-availability">
          <span aria-hidden="true" /> Open to meaningful work
        </p>
        <nav className="hero-professional-links" aria-label={`${name} professional profiles`}>
          {links
            .filter((link) => link.href)
            .map((link) => (
              <a key={link.label} href={link.href}>
                {link.label} <span aria-hidden="true">↗</span>
              </a>
            ))}
          <a href="#experience">
            Explore experience <span aria-hidden="true">↓</span>
          </a>
        </nav>
      </div>
    </section>
  );
}
