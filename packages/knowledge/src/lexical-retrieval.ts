export interface RetrievalCandidate {
  id: string;
  content: string;
  visibility: "public" | "private" | "restricted";
  trustLevel?: string;
  deletedAt?: string;
  metadata?: Record<string, string>;
}

export function lexicalSearch(
  query: string,
  candidates: readonly RetrievalCandidate[],
  limit = 20
): RetrievalCandidate[] {
  const terms = query.toLowerCase().split(/\W+/).filter(Boolean);
  return candidates
    .filter((candidate) => candidate.visibility === "public" && !candidate.deletedAt)
    .map((candidate) => ({
      candidate,
      score: terms.reduce(
        (score, term) => score + (candidate.content.toLowerCase().split(term).length - 1),
        0
      )
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id))
    .slice(0, limit)
    .map((item) => item.candidate);
}
