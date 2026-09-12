const proofSteps = [
  {
    title: "Structure",
    text: "Career history, projects, skills, and outcomes are modelled as connected data."
  },
  {
    title: "Curate",
    text: "Only reviewed facts are projected into the portfolio experience."
  },
  {
    title: "Match",
    text: "A role description is compared with published facts to explain fit."
  },
  {
    title: "Answer",
    text: "The portfolio assistant answers from portfolio facts and returns supporting references."
  }
] as const;

const buildStack = [
  "Next.js",
  "React",
  "TypeScript",
  "Supabase",
  "PostgreSQL",
  "pgvector",
  "Inngest"
];

const architecturePoints = [
  "Private source material is ingested, chunked, and embedded before it becomes searchable portfolio context.",
  "Hybrid retrieval combines lexical search with vector similarity, then ranks context before answer generation.",
  "Public projection and Supabase row-level security ensure only facts selected for publication reach this portfolio.",
  "Async workflow runs keep ingestion, embedding, review, and publication observable and recoverable."
];

const privateCapabilities = [
  "Career knowledge base and fact curation",
  "Job, application, and document workspaces",
  "Interview preparation assistant and interview runs",
  "Automations, analytics, and owner-only settings"
];

export function PortfolioProof({ sourceUrl }: { sourceUrl?: string }) {
  return (
    <div id="proof" className="proof-section" aria-labelledby="proof-title">
      <header className="section-heading section-heading-inverse">
        <p className="eyebrow">Portfolio, as proof</p>
        <h3 id="proof-title">This portfolio is part of the work.</h3>
        <p>
          It is a working software, data, and AI product—not a static résumé dressed as a website.
        </p>
      </header>

      <div className="proof-console" aria-label="Portfolio system flow">
        <div className="proof-console-bar" aria-hidden="true">
          <span />
          <span />
          <span />
          <p>portfolio.system / public-safe pipeline</p>
        </div>
        <ol className="proof-flow">
          {proofSteps.map((step) => (
            <li key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="proof-details">
        <section aria-labelledby="proof-stack-title">
          <p className="proof-detail-label">Technology</p>
          <h4 id="proof-stack-title">Built as a real product.</h4>
          <ul className="proof-stack" aria-label="Portfolio technology stack">
            {buildStack.map((technology) => (
              <li key={technology}>{technology}</li>
            ))}
          </ul>
          <h5>Architecture &amp; AI process</h5>
          <ul className="proof-architecture" aria-label="Portfolio architecture and AI process">
            {architecturePoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="proof-private-title">
          <p className="proof-detail-label">Private workspace</p>
          <h4 id="proof-private-title">More exists behind the public proof.</h4>
          <p>
            This page is the safe public surface. Owner-only tools remain private so personal
            context, preparation, and operational work stay protected.
          </p>
          <ul className="proof-private-capabilities">
            {privateCapabilities.map((capability) => (
              <li key={capability}>{capability}</li>
            ))}
          </ul>
        </section>
      </div>

      <div className="proof-actions">
        <p>
          <span aria-hidden="true">●</span> Live modules
        </p>
        <a href="#ask">Test role fit</a>
        <a href="#ask">Ask the portfolio</a>
        {sourceUrl ? (
          <a href={sourceUrl}>Inspect the source ↗</a>
        ) : (
          <span role="status">Source link is not currently published.</span>
        )}
      </div>
    </div>
  );
}
