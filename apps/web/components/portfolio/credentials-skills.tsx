interface Credential {
  title: string;
  issuer?: string;
  summary?: string;
}

interface SkillGroup {
  title: string;
  skills: string[];
}

export function CredentialsAndSkills({
  credentials,
  skillGroups
}: {
  credentials: Credential[];
  skillGroups: SkillGroup[];
}) {
  if (!credentials.length && !skillGroups.length) return null;
  return (
    <section
      id="capabilities"
      className="public-knowledge"
      aria-labelledby="public-knowledge-title"
    >
      <header className="editorial-heading">
        <p>Technical capabilities</p>
        <h2 id="public-knowledge-title">The skills behind the systems.</h2>
      </header>
      {skillGroups.length ? (
        <div className="public-skill-lines">
          {skillGroups.map((group) => (
            <article key={group.title}>
              <h3>{group.title}</h3>
              <p>{group.skills.join(" · ")}</p>
            </article>
          ))}
        </div>
      ) : null}
      {credentials.length ? (
        <details className="public-credentials">
          <summary>Education and certifications ({credentials.length})</summary>
          <div className="public-credential-lines">
            {credentials.map((credential) => (
              <article key={`${credential.title}-${credential.issuer ?? ""}`}>
                <h3>{credential.title}</h3>
                {credential.issuer ? <strong>{credential.issuer}</strong> : null}
                {credential.summary ? <p>{credential.summary}</p> : null}
              </article>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
