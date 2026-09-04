import { createHash } from "node:crypto";
import { cosineSimilarity } from "./vector-retrieval";
import { reciprocalRankFusion } from "./hybrid-retrieval";
import type { RetrievalCandidate } from "./lexical-retrieval";

const DIMENSIONS = 384;

export function tokenHashEmbedding(text: string, dimensions = DIMENSIONS): number[] {
  if (dimensions < 8 || dimensions > 3072) throw new Error("embedding dimensions out of bounds");
  const vector = Array.from<number>({ length: dimensions }).fill(0);
  const tokens = text.toLowerCase().match(/[\p{L}\p{N}+#.-]{2,}/gu) ?? [];
  for (const token of tokens.slice(0, 4000)) {
    const digest = createHash("sha256").update(token).digest();
    const bucket = digest.readUInt32BE(0) % dimensions;
    vector[bucket] = (vector[bucket] ?? 0) + (digest[4]! % 2 === 0 ? 1 : -1);
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

export function hybridPublicRetrieval(
  query: string,
  candidates: readonly RetrievalCandidate[],
  limit = 8
): RetrievalCandidate[] {
  const safe = candidates.filter(
    (candidate) => candidate.visibility === "public" && !candidate.deletedAt
  );
  if (!query.trim() || !safe.length) return [];
  const queryVector = tokenHashEmbedding(query);
  const semantic = safe
    .map((candidate) => ({
      candidate,
      score: cosineSimilarity(queryVector, tokenHashEmbedding(candidate.content))
    }))
    .filter((result) => result.score > 0.02)
    .sort(
      (left, right) =>
        right.score - left.score || left.candidate.id.localeCompare(right.candidate.id)
    )
    .slice(0, 50)
    .map(({ candidate }) => candidate);
  const fused = reciprocalRankFusion(query, safe, semantic, 25);
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
