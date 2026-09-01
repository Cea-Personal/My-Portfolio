export function fakeRerank(_query: string, candidates: readonly string[]) {
  return candidates.map((_, index) => ({
    index,
    score: 1 - index / Math.max(candidates.length, 1)
  }));
}
