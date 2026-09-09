import { verifyPublicClaim } from "../claim-verifier";
import { hybridPublicRetrieval } from "@career-os/knowledge";
import { hostilePublicInput } from "../input-safety";
export function answerPublicQuestion(
  question: string,
  evidence: readonly { handle: string; text: string; source?: string }[]
): { answer: string; citations: string[]; abstained: boolean } {
  const insufficientEvidence = () =>
    "I couldn't find enough information to answer that yet.";
  if (hostilePublicInput(question))
    return {
      answer: insufficientEvidence(),
      citations: [],
      abstained: true
    };
  const byHandle = new Map(evidence.map((item) => [item.handle, item]));
  const selected = hybridPublicRetrieval(
    question,
    evidence.map((item) => ({
      id: item.handle,
      content: item.text,
      visibility: "public" as const,
      metadata: { source: item.source ?? item.handle }
    })),
    6
  ).flatMap((candidate) => {
    const match = byHandle.get(candidate.id);
    return match ? [match] : [];
  });
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
      answer: insufficientEvidence(),
      citations: [],
      abstained: true
    };
  return { answer: selected[0]!.text, citations, abstained: false };
}
