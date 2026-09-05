import { reciprocalRankFusion } from "./hybrid-retrieval";
import type { RetrievalCandidate } from "./lexical-retrieval";

export const EMBEDDING_DIMENSIONS = 1536;

export function hybridPublicRetrieval(
  query: string,
  candidates: readonly RetrievalCandidate[],
  limit = 8
): RetrievalCandidate[] {
  const safe = candidates.filter(
    (candidate) => candidate.visibility === "public" && !candidate.deletedAt
  );
  if (!query.trim() || !safe.length) return [];
  // Public evidence is deliberately isolated from private vectors. Until a
  // separately approved public vector index is published, use lexical ranking
  // instead of manufacturing deterministic hash vectors in-process.
  const fused = reciprocalRankFusion(query, safe, [], 25);
  const groupCounts = new Map<string, number>();
  return fused
    .filter((candidate) => {
      const group = candidate.metadata?.source ?? candidate.metadata?.title ?? candidate.id;
      const count = groupCounts.get(group) ?? 0;
      if (count >= 2) return false;
      groupCounts.set(group, count + 1);
      return true;
    })
    .slice(0, Math.min(limit, 10));
}
