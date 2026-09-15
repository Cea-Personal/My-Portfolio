export interface RetrievalCandidate {
  id: string;
  content: string;
  visibility: "public" | "private" | "restricted";
  trustLevel?: string;
  deletedAt?: string;
  metadata?: Record<string, string>;
}

const STOP_WORDS = new Set([
  "about",
  "are",
  "basil",
  "can",
  "did",
  "does",
  "for",
  "from",
  "have",
  "has",
  "how",
  "is",
  "me",
  "my",
  "of",
  "on",
  "the",
  "this",
  "to",
  "what",
  "when",
  "where",
  "which",
  "who",
  "with",
  "your"
]);

export function lexicalSearch(
  query: string,
  candidates: readonly RetrievalCandidate[],
  limit = 20
): RetrievalCandidate[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((term) => (term.length > 2 || term === "ai") && !STOP_WORDS.has(term));
  return candidates
    .filter((candidate) => candidate.visibility === "public" && !candidate.deletedAt)
    .map((candidate) => {
      const contentTerms = candidate.content
        .toLowerCase()
        .split(/[^a-z0-9+#.]+/)
        .filter(Boolean);
      return {
        candidate,
        score: terms.reduce(
          (score, term) =>
            score +
            (contentTerms.some(
              (contentTerm) => contentTerm === term || contentTerm.startsWith(term)
            )
              ? 1
              : 0),
          0
        )
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id))
    .slice(0, limit)
    .map((item) => item.candidate);
}
