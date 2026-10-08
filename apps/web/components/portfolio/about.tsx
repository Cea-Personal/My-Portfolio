export function About({
  bio = "A clear, fact-based view of the work behind the outcomes.",
  additionalSummary
}: {
  bio?: string;
  additionalSummary?: string;
}) {
  return (
    <section id="about" className="about-section" aria-labelledby="about-title">
      <p className="section-index">About</p>
      <div className="about-layout">
        <h2 id="about-title">
          Software taught me structure. Data taught me scale. AI taught me to keep asking better
          questions.
        </h2>
        <p className="about-lede">{bio}</p>
        <p className="about-detail">
          I care about the full path from a difficult problem to a system people can trust and use.
        </p>
        {additionalSummary ? (
          <details className="about-full-summary">
            <summary>More about the work</summary>
            <p>{additionalSummary}</p>
          </details>
        ) : null}
      </div>
    </section>
  );
}
