export function Impact({ items }: { items: readonly { title: string; summary?: string }[] }) {
  if (!items.length) return null;
  return (
    <section id="impact" className="selected-impact" aria-labelledby="impact-title">
      <header className="editorial-heading">
        <p>Selected impact</p>
        <h2 id="impact-title">The outcomes behind the work.</h2>
      </header>
      <ul className="selected-impact-list">
        {items.slice(0, 6).map((item) => (
          <li key={item.title} className={/^\d/.test(item.title) ? "impact-metric" : undefined}>
            <h3>{item.title}</h3>
            {item.summary ? <p>{item.summary}</p> : null}
          </li>
        ))}
      </ul>
      <a className="text-link" href="#experience">
        Explore the experience behind these outcomes →
      </a>
    </section>
  );
}
