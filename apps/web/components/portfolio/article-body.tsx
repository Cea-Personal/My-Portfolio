export function ArticleBody({ markdown }: { markdown: string }) {
  const blocks = markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  return (
    <article className="article-body">
      {blocks.map((block, index) => {
        const key = `${String(index)}-${block.slice(0, 24)}`;
        if (block.startsWith("### ")) return <h3 key={key}>{block.slice(4)}</h3>;
        if (block.startsWith("## ")) return <h2 key={key}>{block.slice(3)}</h2>;
        if (block.startsWith("# ")) return <h2 key={key}>{block.slice(2)}</h2>;
        if (block.split("\n").every((line) => /^[-*] /.test(line)))
          return (
            <ul key={key}>
              {block.split("\n").map((line) => (
                <li key={line}>{line.slice(2)}</li>
              ))}
            </ul>
          );
        if (block.startsWith("```"))
          return <pre key={key}>{block.replace(/^```[^\n]*\n?|```$/g, "")}</pre>;
        return <p key={key}>{block.replace(/\n/g, " ")}</p>;
      })}
    </article>
  );
}
