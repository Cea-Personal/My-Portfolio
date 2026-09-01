import { verifyPublicClaim } from "../claim-verifier";
export function answerPublicQuestion(
  question: string,
  evidence: readonly { handle: string; text: string }[]
): { answer: string; citations: string[]; abstained: boolean } {
  const terms = question.toLowerCase().split(/\W+/).filter(Boolean);
  const ranked = evidence
    .map((item, index) => ({
      item,
      index,
      score: terms.reduce((sum, term) => sum + (item.text.toLowerCase().split(term).length - 1), 0)
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .filter((item) => item.score > 0 || terms.length === 0)
    .slice(0, 5)
    .map((item) => item.item);
  // Never fall back to an arbitrary evidence item: an unrelated public claim
  // must not be presented as an answer to an unsupported or private question.
  const selected = ranked;
  const citations = selected.map((item) => item.handle);
  if (
    !question.trim() ||
    !selected.length ||
    !verifyPublicClaim(
      { statement: selected[0]?.text ?? "", evidenceHandles: citations, visibility: "public" },
      new Set(citations)
    ).verified
  )
    return {
      answer: "I don't have enough approved public evidence to answer that.",
      citations: [],
      abstained: true
    };
  return { answer: selected[0]!.text, citations, abstained: false };
}
