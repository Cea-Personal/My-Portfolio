export function Impact({ metrics = [] }: { metrics?: readonly string[] }) {
  return (
    <section id="impact" aria-labelledby="impact-title">
      <h2 id="impact-title">Impact</h2>
      {metrics.length ? (
        <ul>
          {metrics.map((metric) => (
            <li key={metric}>{metric}</li>
          ))}
        </ul>
      ) : (
        <p>Measured outcomes will appear here.</p>
      )}
    </section>
  );
}
