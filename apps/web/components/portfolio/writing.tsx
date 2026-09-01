export function Writing({
  items = []
}: {
  items?: readonly { title: string; summary: string; href?: string; meta?: string }[];
}) {
  return (
    <section id="blog" className="blog-section" aria-labelledby="writing-title">
      <header className="blog-editorial-heading">
        <p>06 / Blog</p>
        <h2 id="writing-title">
          Notes from making solutions <em>people actually use.</em>
        </h2>
        <a href="/blog">Read all writing ↗</a>
      </header>
      {items.length ? (
        <ol className="writing-index">
          {items.map((item, index) => (
            <li key={item.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <p>{item.meta ?? "From the work"}</p>
                <h3>{item.href ? <a href={item.href}>{item.title}</a> : item.title}</h3>
                <span>{item.summary}</span>
              </div>
              {item.href ? (
                <a href={item.href} aria-label={`Read ${item.title}`}>
                  Read ↗
                </a>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <div className="writing-empty">
          <p>Writing archive / preparing</p>
          <h3>The first field notes will appear here when published.</h3>
        </div>
      )}
    </section>
  );
}
