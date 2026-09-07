export function About({
  bio = "A clear, fact-based view of the work behind the outcomes."
}: {
  bio?: string;
}) {
  return (
    <section id="about" className="about-section" aria-labelledby="about-title">
      <p className="section-index">About</p>
      <div className="about-layout">
        <h2 id="about-title">
          Software taught me structure. Data taught me scale. AI taught me to keep asking better
          questions.
        </h2>
        <div>
          <p className="about-lede">{bio}</p>
          <p className="about-detail">
            I care about the full path from a difficult problem to a system people can trust and
            use.
          </p>
        </div>
        <ul className="about-principles" aria-label="Working principles">
          <li>
            <span>01</span>
            Software foundations
          </li>
          <li>
            <span>02</span>
            Reliable data platforms
          </li>
          <li>
            <span>03</span>
            Practical AI systems
          </li>
        </ul>
      </div>
    </section>
  );
}
