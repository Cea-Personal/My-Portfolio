interface ProfileLink {
  label: string;
  href?: string;
}

export function ProfileRail({
  name,
  photoSrc,
  links = [],
  statement,
  className
}: {
  name: string;
  photoSrc?: string;
  links?: readonly ProfileLink[];
  statement?: string;
  className?: string;
}) {
  return (
    <aside
      className={`profile-rail${className ? ` ${className}` : ""}`}
      aria-label={`${name} profile`}
    >
      <div
        className={`profile-portrait${photoSrc ? " has-photo" : ""}`}
        {...(!photoSrc ? { role: "img", "aria-label": `Portrait placeholder for ${name}` } : {})}
      >
        {photoSrc ? (
          <img src={photoSrc} alt={`Portrait of ${name}`} />
        ) : (
          <span aria-hidden="true">BO</span>
        )}
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
      {statement ? <p className="profile-statement">{statement}</p> : null}
      <div className="profile-availability-wrap">
        <p className="profile-availability">
          <span aria-hidden="true" /> Open to meaningful work
        </p>
      </div>
    </aside>
  );
}
