export interface VectorCandidate {
  id: string;
  vector: readonly number[];
  visibility: "public" | "private" | "restricted";
  deletedAt?: string;
}
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || !a.length) throw new Error("Embedding dimensions must match");
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index]! * b[index]!;
    aNorm += a[index]! ** 2;
    bNorm += b[index]! ** 2;
  }
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm) || 1);
}
export function vectorSearch(
  query: readonly number[],
  candidates: readonly VectorCandidate[],
  limit = 20
): { candidate: VectorCandidate; score: number }[] {
  return candidates
    .filter((candidate) => candidate.visibility === "public" && !candidate.deletedAt)
    .filter((candidate) => candidate.vector.length === query.length)
    .map((candidate) => ({ candidate, score: cosineSimilarity(query, candidate.vector) }))
    .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id))
    .slice(0, limit);
}
