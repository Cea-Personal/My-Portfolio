interface ProfileLink {
  label: string;
  href?: string;
}

export function ProfileRail({
  name,
  photoSrc,
  links = []
}: {
  name: string;
  photoSrc?: string;
  links?: readonly ProfileLink[];
}) {
  return (
    <aside className="profile-rail" aria-label={`${name} profile`}>
      <div
        className={`profile-portrait${photoSrc ? " has-photo" : ""}`}
        style={photoSrc ? { backgroundImage: `url(${JSON.stringify(photoSrc)})` } : undefined}
        role="img"
        aria-label={photoSrc ? `Portrait of ${name}` : `Portrait placeholder for ${name}`}
      >
        {photoSrc ? null : <span aria-hidden="true">BO</span>}
      </div>
      <nav className="profile-links" aria-label="Basil Ogbonna profiles">
        {links.map((link) =>
          link.href ? (
            <a key={link.label} href={link.href}>
              {link.label} <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <span className="profile-link-placeholder" key={link.label}>
              {link.label}
            </span>
          )
        )}
      </nav>
      <p className="profile-statement">
        I engineer software, data platforms, and AI systems that move difficult ideas into reliable
        production.
      </p>
      <div className="profile-availability-wrap">
        <p className="profile-availability">
          <span aria-hidden="true" /> Open to meaningful work
        </p>
      </div>
    </aside>
  );
}
