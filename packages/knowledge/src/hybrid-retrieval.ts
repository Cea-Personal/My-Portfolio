import type { RetrievalCandidate } from "./lexical-retrieval";
import { lexicalSearch } from "./lexical-retrieval";

export function reciprocalRankFusion(
  query: string,
  lexical: readonly RetrievalCandidate[],
  semantic: readonly RetrievalCandidate[],
  limit = 20,
  k = 60
): RetrievalCandidate[] {
  const scores = new Map<string, { candidate: RetrievalCandidate; score: number }>();
  const lexicalResults = lexicalSearch(query, lexical, limit);
  const semanticResults = semantic
    .filter((candidate) => candidate.visibility === "public" && !candidate.deletedAt)
    .slice(0, limit);
  for (const [rank, candidate] of lexicalResults.entries()) {
    const current = scores.get(candidate.id) ?? { candidate, score: 0 };
    current.score += 1 / (k + rank + 1);
    scores.set(candidate.id, current);
  }
  for (const [rank, candidate] of semanticResults.entries()) {
    const current = scores.get(candidate.id) ?? { candidate, score: 0 };
    current.score += 1 / (k + rank + 1);
    scores.set(candidate.id, current);
  }
  return [...scores.values()]
    .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id))
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}
